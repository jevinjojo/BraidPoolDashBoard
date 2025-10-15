use axum::{
    extract::Path,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use bitcoincore_rpc::bitcoin::Amount;
use bitcoincore_rpc::bitcoin::{Transaction, Txid};
use bitcoincore_rpc::{Auth, Client, RpcApi};
use futures::stream::{self, StreamExt};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

// ============================================================================
// DATA STRUCTURES
// ============================================================================

#[derive(Serialize)]
struct ApiStatus {
    confirmed: bool,
    block_height: Option<u64>,
    block_hash: Option<String>,
    block_time: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "snake_case")]
pub struct ApiTransaction {
    pub txid: String,
    pub hash: String,
    pub category: String, // Mempool | Proposed | Scheduled | Confirmed | Replaced
    pub size: u64,
    pub weight: Option<u64>,
    pub fee: f64,
    pub fee_rate: f64,
    pub inputs: usize,
    pub outputs: usize,
    pub confirmations: u32,
    pub work: Option<f64>,
    pub work_unit: Option<String>,
    pub timestamp: Option<u64>,
    pub rbf_signaled: bool,
    pub status: ApiStatus,
    pub metadata: Option<TransactionMetadata>, // NEW: Additional metadata
}

#[derive(Serialize, Clone)]
pub struct TransactionMetadata {
    pub proposed_at: Option<u64>,
    pub scheduled_at: Option<u64>,
    pub notes: Option<String>,
}

#[derive(Serialize)]
pub struct ApiMempoolInfo {
    pub count: usize,
    pub vsize: u64,
    pub total_fee: u64,
    pub fee_histogram: Vec<[f64; 2]>,
}

#[derive(Serialize)]
pub struct DashboardStats {
    pub mempool_count: usize,
    pub proposed_count: usize,
    pub scheduled_count: usize,
    pub confirmed_count: usize,
    pub total_mempool_fee: f64,
    pub total_proposed_fee: f64,
    pub total_scheduled_fee: f64,
}

#[derive(Deserialize)]
pub struct ProposeRequest {
    pub notes: Option<String>,
}

#[derive(Deserialize)]
pub struct BulkTransactionRequest {
    pub txids: Vec<String>,
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

struct StateStore {
    proposed: HashSet<Txid>,
    scheduled: HashSet<Txid>,
    metadata: HashMap<Txid, TransactionMetadata>,
}

impl StateStore {
    fn new() -> Self {
        StateStore {
            proposed: HashSet::new(),
            scheduled: HashSet::new(),
            metadata: HashMap::new(),
        }
    }

    fn propose(&mut self, txid: Txid, notes: Option<String>) {
        self.proposed.insert(txid);
        self.metadata.insert(
            txid,
            TransactionMetadata {
                proposed_at: Some(now_ts()),
                scheduled_at: None,
                notes,
            },
        );
    }

    fn schedule(&mut self, txid: Txid) {
        self.proposed.remove(&txid);
        self.scheduled.insert(txid);
        
        if let Some(meta) = self.metadata.get_mut(&txid) {
            meta.scheduled_at = Some(now_ts());
        } else {
            self.metadata.insert(
                txid,
                TransactionMetadata {
                    proposed_at: None,
                    scheduled_at: Some(now_ts()),
                    notes: None,
                },
            );
        }
    }

    fn reject(&mut self, txid: Txid) {
        self.proposed.remove(&txid);
        self.metadata.remove(&txid);
    }

    fn unschedule(&mut self, txid: Txid) {
        self.scheduled.remove(&txid);
        self.metadata.remove(&txid);
    }

    fn is_proposed(&self, txid: &Txid) -> bool {
        self.proposed.contains(txid)
    }

    fn is_scheduled(&self, txid: &Txid) -> bool {
        self.scheduled.contains(txid)
    }

    fn get_metadata(&self, txid: &Txid) -> Option<TransactionMetadata> {
        self.metadata.get(txid).cloned()
    }

    fn cleanup_confirmed(&mut self, txid: &Txid) {
        self.proposed.remove(txid);
        self.scheduled.remove(txid);
        self.metadata.remove(txid);
    }
}

static STATE: Lazy<Mutex<StateStore>> = Lazy::new(|| Mutex::new(StateStore::new()));
static SEEN: Lazy<Mutex<HashMap<Txid, u64>>> = Lazy::new(|| Mutex::new(HashMap::new()));

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

fn connect_to_bitcoind() -> Client {
    Client::new(
        "http://127.0.0.1:18332",
        Auth::UserPass("jevinrpc".to_string(), "securepass123".to_string()),
    )
    .expect("Failed to connect to bitcoind_node")
}

fn connect_to_cmempoold() -> Client {
    Client::new(
        "http://127.0.0.1:19443",
        Auth::UserPass("cmempoolrpc".to_string(), "securepass456".to_string()),
    )
    .expect("Failed to connect to cmempoold_node")
}

fn now_ts() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

fn to_sats(amount: Amount) -> u64 {
    amount.to_sat()
}

fn to_btc_from_sats(sats: u64) -> f64 {
    (sats as f64) / 100_000_000.0
}

fn detect_category(
    txid: &Txid,
    in_std: bool,
    in_cpool: bool,
    confirmations: u32,
) -> String {
    // Priority: Confirmed > Scheduled > Proposed > Mempool > Replaced > Unknown
    
    if confirmations > 0 {
        return "Confirmed".to_string();
    }

    let state = STATE.lock().unwrap();
    
    // If in cmempool, it's scheduled
    if in_cpool || state.is_scheduled(txid) {
        return "Scheduled".to_string();
    }

    // If marked as proposed
    if state.is_proposed(txid) {
        return "Proposed".to_string();
    }

    // If in bitcoind mempool only
    if in_std {
        return "Mempool".to_string();
    }

    // Check if was previously seen (RBF replacement)
    let mut seen = SEEN.lock().unwrap();
    if seen.remove(txid).is_some() {
        return "Replaced".to_string();
    }

    "Unknown".to_string()
}

fn record_seen(txid: &Txid, in_any_mempool: bool, ts: u64) {
    if in_any_mempool {
        SEEN.lock().unwrap().insert(*txid, ts);
    }
}

fn build_tx(txid: Txid, standard: &Client, committed: &Client) -> ApiTransaction {
    let in_std_entry = standard.get_mempool_entry(&txid).ok();
    let in_cpool_entry = committed.get_mempool_entry(&txid).ok();

    let raw_info = standard
        .get_raw_transaction_info(&txid, None)
        .or_else(|_| committed.get_raw_transaction_info(&txid, None))
        .ok();

    let (confirmations, block_hash, block_time, vsize_raw, inputs, outputs) =
        if let Some(info) = &raw_info {
            (
                info.confirmations.unwrap_or(0) as u32,
                info.blockhash.map(|h| h.to_string()),
                info.blocktime.map(|t| t as u64),
                info.vsize as u64,
                info.vin.len(),
                info.vout.len(),
            )
        } else {
            (0, None, None, 0, 0, 0)
        };

    let mempool = in_std_entry.as_ref().or(in_cpool_entry.as_ref());
    let (vsize, fee_sats, ts_mempool_time, rbf_signaled) = if let Some(e) = mempool {
        (
            e.vsize as u64,
            to_sats(e.fees.base),
            Some(e.time as u64),
            e.bip125_replaceable,
        )
    } else {
        (vsize_raw, 0, None, false)
    };

    let fee_rate = if vsize > 0 {
        (fee_sats as f64) / (vsize as f64)
    } else {
        0.0
    };

    let in_std = in_std_entry.is_some();
    let in_cpool = in_cpool_entry.is_some();
    let category = detect_category(&txid, in_std, in_cpool, confirmations);

    let ts = ts_mempool_time.or(block_time).unwrap_or_else(now_ts);
    record_seen(&txid, in_std || in_cpool, ts);

    // Cleanup if confirmed
    if confirmations > 0 {
        STATE.lock().unwrap().cleanup_confirmed(&txid);
    }

    // Get metadata
    let metadata = STATE.lock().unwrap().get_metadata(&txid);

    ApiTransaction {
        txid: txid.to_string(),
        hash: txid.to_string(),
        category,
        size: vsize,
        weight: None,
        fee: to_btc_from_sats(fee_sats),
        fee_rate,
        inputs,
        outputs,
        confirmations,
        work: None,
        work_unit: None,
        timestamp: ts_mempool_time.or(block_time),
        rbf_signaled,
        status: ApiStatus {
            confirmed: confirmations > 0,
            block_height: None,
            block_hash,
            block_time,
        },
        metadata,
    }
}

// ============================================================================
// EXISTING ENDPOINTS (UPDATED)
// ============================================================================

pub async fn get_transactions() -> Json<Vec<ApiTransaction>> {
    let standard = Arc::new(connect_to_bitcoind());
    let committed = Arc::new(connect_to_cmempoold());

    let std_txids = standard.get_raw_mempool().unwrap_or_default();
    let cpool_txids = committed.get_raw_mempool().unwrap_or_default();
    let set: BTreeSet<_> = std_txids
        .into_iter()
        .chain(cpool_txids.into_iter())
        .collect();

    let results = stream::iter(set.into_iter())
        .map(|txid| {
            let standard = Arc::clone(&standard);
            let committed = Arc::clone(&committed);
            async move { build_tx(txid, standard.as_ref(), committed.as_ref()) }
        })
        .buffer_unordered(16)
        .collect::<Vec<_>>()
        .await;

    Json(results)
}

pub async fn get_transaction_detail(Path(txid): Path<String>) -> Json<ApiTransaction> {
    let standard = connect_to_bitcoind();
    let committed = connect_to_cmempoold();
    let txid_parsed = txid.parse::<Txid>().unwrap();
    Json(build_tx(txid_parsed, &standard, &committed))
}

pub async fn get_mempool_info() -> Json<ApiMempoolInfo> {
    let standard = connect_to_bitcoind();
    let committed = connect_to_cmempoold();

    let std_txids = standard.get_raw_mempool().unwrap_or_default();
    let cpool_txids = committed.get_raw_mempool().unwrap_or_default();
    let set: BTreeSet<_> = std_txids
        .into_iter()
        .chain(cpool_txids.into_iter())
        .collect();

    let mut total_vsize: u64 = 0;
    let mut total_fee_sats: u64 = 0;
    let mut histogram: BTreeMap<u64, u64> = BTreeMap::new();

    for txid in set.iter() {
        let entry = standard
            .get_mempool_entry(txid)
            .ok()
            .or_else(|| committed.get_mempool_entry(txid).ok());

        if let Some(e) = entry {
            let vsize = e.vsize as u64;
            let fee_sats = to_sats(e.fees.base);
            total_vsize += vsize;
            total_fee_sats += fee_sats;

            if vsize > 0 {
                let fee_rate = (fee_sats as f64) / (vsize as f64);
                let bucket = fee_rate.round() as u64;
                *histogram.entry(bucket).or_insert(0) += vsize;
            }
        }
    }

    let fee_histogram: Vec<[f64; 2]> = histogram
        .into_iter()
        .map(|(bucket, vsz)| [bucket as f64, vsz as f64])
        .collect();

    Json(ApiMempoolInfo {
        count: set.len(),
        vsize: total_vsize,
        total_fee: total_fee_sats,
        fee_histogram,
    })
}

// ============================================================================
// NEW: TRANSACTION MANAGEMENT ENDPOINTS
// ============================================================================

pub async fn propose_transaction(
    Path(txid): Path<String>,
    Json(payload): Json<ProposeRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    let standard = connect_to_bitcoind();

    let txid = match txid.parse::<Txid>() {
        Ok(t) => t,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"status":"error","error":format!("invalid txid: {e}")})),
            )
        }
    };

    // Check if transaction exists in bitcoind mempool
    if standard.get_mempool_entry(&txid).is_err() {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({
                "status":"error",
                "error":"Transaction not found in mempool"
            })),
        );
    }

    // Check if already scheduled
    if STATE.lock().unwrap().is_scheduled(&txid) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "status":"error",
                "error":"Transaction already scheduled"
            })),
        );
    }

    // Mark as proposed
    STATE.lock().unwrap().propose(txid, payload.notes);

    (
        StatusCode::OK,
        Json(json!({
            "status":"ok",
            "txid":txid.to_string(),
            "message":"Transaction proposed"
        })),
    )
}

pub async fn schedule_transaction(
    Path(txid): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    let standard = connect_to_bitcoind();
    let committed = connect_to_cmempoold();

    let txid = match txid.parse::<Txid>() {
        Ok(t) => t,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"status":"error","error":format!("invalid txid: {e}")})),
            )
        }
    };

    // Check if transaction is proposed
    if !STATE.lock().unwrap().is_proposed(&txid) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "status":"error",
                "error":"Transaction must be proposed before scheduling"
            })),
        );
    }

    // Check if already in cmempool
    if let Ok(_) = committed.get_mempool_entry(&txid) {
        STATE.lock().unwrap().schedule(txid);
        return (
            StatusCode::OK,
            Json(json!({
                "status":"ok",
                "txid":txid.to_string(),
                "message":"Transaction already scheduled"
            })),
        );
    }

    // Get transaction from bitcoind
    let tx: Transaction = match standard.get_raw_transaction(&txid, None) {
        Ok(t) => t,
        Err(e) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({
                    "status":"error",
                    "error":format!("Transaction not found: {e}")
                })),
            )
        }
    };

    // Get block heights for diagnostics
    let std_height = standard.get_block_count().unwrap_or(0);
    let cm_height = committed.get_block_count().unwrap_or(0);

    // Send to cmempool
    match committed.send_raw_transaction(&tx) {
        Ok(_) => {
            // Mark as scheduled in state
            STATE.lock().unwrap().schedule(txid);

            (
                StatusCode::OK,
                Json(json!({
                    "status":"ok",
                    "txid":txid.to_string(),
                    "message":"Transaction scheduled successfully"
                })),
            )
        }
        Err(e) => {
            let error_str = e.to_string();
            
            let mut diagnostics = json!({
                "error": error_str.clone(),
                "bitcoind_height": std_height,
                "cmempool_height": cm_height,
            });

            if error_str.contains("-25") 
                || error_str.contains("missing inputs") 
                || error_str.contains("bad-txns-inputs-missingorspent") 
            {
                diagnostics["hint"] = json!(
                    "Nodes not synchronized. Check block heights match."
                );
                diagnostics["possible_cause"] = json!("Blockchain state mismatch");
            }

            (
                StatusCode::BAD_REQUEST,
                Json(json!({"status":"error","diagnostics":diagnostics})),
            )
        },
    }
}

pub async fn reject_transaction(
    Path(txid): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    let txid = match txid.parse::<Txid>() {
        Ok(t) => t,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"status":"error","error":format!("invalid txid: {e}")})),
            )
        }
    };

    if !STATE.lock().unwrap().is_proposed(&txid) {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({
                "status":"error",
                "error":"Transaction not in proposed state"
            })),
        );
    }

    STATE.lock().unwrap().reject(txid);

    (
        StatusCode::OK,
        Json(json!({
            "status":"ok",
            "txid":txid.to_string(),
            "message":"Transaction rejected"
        })),
    )
}

pub async fn unschedule_transaction(
    Path(txid): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    let txid = match txid.parse::<Txid>() {
        Ok(t) => t,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"status":"error","error":format!("invalid txid: {e}")})),
            )
        }
    };

    if !STATE.lock().unwrap().is_scheduled(&txid) {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({
                "status":"error",
                "error":"Transaction not scheduled"
            })),
        );
    }

    // Note: We don't remove from cmempool, just update our state
    // To actually remove from cmempool, would need to use prioritisetransaction
    // with negative fee or wait for it to be replaced
    STATE.lock().unwrap().unschedule(txid);

    (
        StatusCode::OK,
        Json(json!({
            "status":"ok",
            "txid":txid.to_string(),
            "message":"Transaction unscheduled (removed from state, still in cmempool)"
        })),
    )
}

pub async fn bulk_propose(
    Json(payload): Json<BulkTransactionRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    let standard = connect_to_bitcoind();
    let mut succeeded = Vec::new();
    let mut failed = Vec::new();

    for txid_str in payload.txids {
        let txid = match txid_str.parse::<Txid>() {
            Ok(t) => t,
            Err(_) => {
                failed.push(json!({"txid": txid_str, "error": "Invalid txid"}));
                continue;
            }
        };

        if standard.get_mempool_entry(&txid).is_ok() {
            STATE.lock().unwrap().propose(txid, None);
            succeeded.push(txid_str);
        } else {
            failed.push(json!({"txid": txid_str, "error": "Not found in mempool"}));
        }
    }

    (
        StatusCode::OK,
        Json(json!({
            "status":"ok",
            "succeeded": succeeded,
            "failed": failed
        })),
    )
}

pub async fn bulk_schedule(
    Json(payload): Json<BulkTransactionRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    let standard = connect_to_bitcoind();
    let committed = connect_to_cmempoold();
    let mut succeeded = Vec::new();
    let mut failed = Vec::new();

    for txid_str in payload.txids {
        let txid = match txid_str.parse::<Txid>() {
            Ok(t) => t,
            Err(_) => {
                failed.push(json!({"txid": txid_str, "error": "Invalid txid"}));
                continue;
            }
        };

        if !STATE.lock().unwrap().is_proposed(&txid) {
            failed.push(json!({"txid": txid_str, "error": "Not proposed"}));
            continue;
        }

        let tx = match standard.get_raw_transaction(&txid, None) {
            Ok(t) => t,
            Err(_) => {
                failed.push(json!({"txid": txid_str, "error": "Not found"}));
                continue;
            }
        };

        match committed.send_raw_transaction(&tx) {
            Ok(_) => {
                STATE.lock().unwrap().schedule(txid);
                succeeded.push(txid_str);
            }
            Err(e) => {
                failed.push(json!({"txid": txid_str, "error": e.to_string()}));
            }
        }
    }

    (
        StatusCode::OK,
        Json(json!({
            "status":"ok",
            "succeeded": succeeded,
            "failed": failed
        })),
    )
}

// ============================================================================
// NEW: DASHBOARD ENDPOINTS
// ============================================================================

pub async fn get_dashboard_stats() -> Json<DashboardStats> {
    let standard = Arc::new(connect_to_bitcoind());
    let committed = Arc::new(connect_to_cmempoold());

    let std_txids = standard.get_raw_mempool().unwrap_or_default();
    let cpool_txids = committed.get_raw_mempool().unwrap_or_default();
    let all_txids: BTreeSet<_> = std_txids
        .into_iter()
        .chain(cpool_txids.into_iter())
        .collect();

    let mut mempool_count = 0;
    let mut proposed_count = 0;
    let mut scheduled_count = 0;
    let mut total_mempool_fee = 0.0;
    let mut total_proposed_fee = 0.0;
    let mut total_scheduled_fee = 0.0;

    let state = STATE.lock().unwrap();

    for txid in all_txids {
        let entry = standard
            .get_mempool_entry(&txid)
            .ok()
            .or_else(|| committed.get_mempool_entry(&txid).ok());

        if let Some(e) = entry {
            let fee = to_btc_from_sats(to_sats(e.fees.base));
            let in_cpool = committed.get_mempool_entry(&txid).is_ok();

            if in_cpool || state.is_scheduled(&txid) {
                scheduled_count += 1;
                total_scheduled_fee += fee;
            } else if state.is_proposed(&txid) {
                proposed_count += 1;
                total_proposed_fee += fee;
            } else {
                mempool_count += 1;
                total_mempool_fee += fee;
            }
        }
    }

    Json(DashboardStats {
        mempool_count,
        proposed_count,
        scheduled_count,
        confirmed_count: 0, // Would need to track recent confirmations
        total_mempool_fee,
        total_proposed_fee,
        total_scheduled_fee,
    })
}

pub async fn get_dashboard_mempool() -> Json<Vec<ApiTransaction>> {
    let transactions = get_transactions().await.0;
    let filtered: Vec<_> = transactions
        .into_iter()
        .filter(|tx| tx.category == "Mempool")
        .collect();
    Json(filtered)
}

pub async fn get_dashboard_proposed() -> Json<Vec<ApiTransaction>> {
    let transactions = get_transactions().await.0;
    let filtered: Vec<_> = transactions
        .into_iter()
        .filter(|tx| tx.category == "Proposed")
        .collect();
    Json(filtered)
}

pub async fn get_dashboard_scheduled() -> Json<Vec<ApiTransaction>> {
    let transactions = get_transactions().await.0;
    let filtered: Vec<_> = transactions
        .into_iter()
        .filter(|tx| tx.category == "Scheduled")
        .collect();
    Json(filtered)
}

// ============================================================================
// ROUTER
// ============================================================================

pub fn build_router() -> Router {
    Router::new()
        // Original endpoints
        .route("/transactions", get(get_transactions))
        .route("/tx/{txid}", get(get_transaction_detail))
        .route("/mempool/info", get(get_mempool_info))
        
        // Transaction management
        .route("/transactions/{txid}/propose", post(propose_transaction))
        .route("/transactions/{txid}/schedule", post(schedule_transaction))
        .route("/transactions/{txid}/reject", post(reject_transaction))
        .route("/transactions/{txid}/unschedule", post(unschedule_transaction))
        
        // Bulk operations
        .route("/transactions/bulk/propose", post(bulk_propose))
        .route("/transactions/bulk/schedule", post(bulk_schedule))
        
        // Dashboard
        .route("/dashboard/stats", get(get_dashboard_stats))
        .route("/dashboard/mempool", get(get_dashboard_mempool))
        .route("/dashboard/proposed", get(get_dashboard_proposed))
        .route("/dashboard/scheduled", get(get_dashboard_scheduled))
}
