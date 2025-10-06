use axum::{
    extract::Path,
    http::StatusCode,
    routing::{delete, get, post},
    Json, Router,
};
use bitcoincore_rpc::bitcoin::Amount;
use bitcoincore_rpc::bitcoin::{BlockHash, Transaction, Txid};
use bitcoincore_rpc::{Auth, Client, RpcApi};
use futures::stream::{self, StreamExt};
use once_cell::sync::Lazy;
use serde::Serialize;
use serde_json::json;
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use std::str::FromStr;

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
    pub category: String, // Mempool | Committed | Confirmed | Replaced | Unknown
    pub size: u64,        // vsize in vbytes
    pub weight: Option<u64>,
    pub fee: f64,         // BTC
    pub fee_rate: f64,    // sats/vB
    pub inputs: usize,
    pub outputs: usize,
    pub confirmations: u32,
    pub work: Option<f64>,
    pub work_unit: Option<String>,
    pub timestamp: Option<u64>,
    pub rbf_signaled: bool,
    pub status: ApiStatus,
    // Detailed fields (optional; present for detail view)
    pub vin: Option<serde_json::Value>,
    pub vout: Option<serde_json::Value>,
    pub version: Option<i32>,
    pub locktime: Option<u32>,
}

#[derive(Serialize)]
pub struct ApiMempoolInfo {
    pub count: usize,
    pub vsize: u64,
    pub total_fee: u64,               // sats
    pub fee_histogram: Vec<[f64; 2]>, // [feeRate_sats_per_vB, total_vsize]
}

static SEEN: Lazy<Mutex<HashMap<Txid, u64>>> = Lazy::new(|| Mutex::new(HashMap::new()));
static PROPOSED: Lazy<Mutex<BTreeSet<Txid>>> = Lazy::new(|| Mutex::new(BTreeSet::new()));
static SCHEDULED: Lazy<Mutex<BTreeSet<Txid>>> = Lazy::new(|| Mutex::new(BTreeSet::new()));

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
    in_proposed: bool,
    in_scheduled: bool,
) -> String {
    if confirmations > 0 {
        return "Confirmed".to_string();
    }
    // Proposed is a subset of committed
    if in_cpool && in_proposed {
        return "Proposed".to_string();
    }
    if in_cpool {
        return "Committed".to_string();
    }
    // Scheduled is a subset of the standard mempool
    if in_std && in_scheduled {
        return "Scheduled".to_string();
    }
    if in_std {
        return "Mempool".to_string();
    }
    // Replaced heuristic: seen before, now gone from both mempools, still unconfirmed
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

    // Prefer raw tx info from standard, fall back to committed
    let raw_info = standard
        .get_raw_transaction_info(&txid, None)
        .or_else(|_| committed.get_raw_transaction_info(&txid, None))
        .ok();

    let (confirmations, block_hash, block_time, vsize_raw, inputs, outputs, version, locktime, vin_json, vout_json) =
        if let Some(info) = &raw_info {
            (
                info.confirmations.unwrap_or(0) as u32,
                info.blockhash.map(|h| h.to_string()),
                info.blocktime.map(|t| t as u64),
                info.vsize as u64, // vsize is not Option in this crate version
                info.vin.len(),
                info.vout.len(),
                Some(info.version),
                Some(info.locktime),
                serde_json::to_value(&info.vin).ok(),
                serde_json::to_value(&info.vout).ok(),
            )
        } else {
            (0, None, None, 0, 0, 0, None, None, None, None)
        };

    // Prefer mempool entry data when unconfirmed
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
    let in_proposed = {
        let set = PROPOSED.lock().unwrap();
        set.contains(&txid)
    };
    let in_scheduled = {
        let set = SCHEDULED.lock().unwrap();
        set.contains(&txid)
    };
    let category = detect_category(
        &txid,
        in_std,
        in_cpool,
        confirmations,
        in_proposed,
        in_scheduled,
    );

    let ts = ts_mempool_time.or(block_time).unwrap_or_else(now_ts);
    record_seen(&txid, in_std || in_cpool, ts);

    // Compute a simple work estimate for unconfirmed txs (arbitrary units)
    let work_estimate = if confirmations == 0 && vsize > 0 {
        Some(((fee_sats as f64) / (vsize as f64)).max(0.0))
    } else {
        None
    };

    // Optionally compute block height if block hash is known
    let block_height = if let Some(ref h) = block_hash {
        BlockHash::from_str(h)
            .ok()
            .and_then(|bh| standard.get_block_header_info(&bh).ok())
            .map(|hdr| hdr.height as u64)
            .or_else(|| {
                BlockHash::from_str(h)
                    .ok()
                    .and_then(|bh| committed.get_block_header_info(&bh).ok())
                    .map(|hdr| hdr.height as u64)
            })
    } else {
        None
    };

    ApiTransaction {
        txid: txid.to_string(),
        hash: txid.to_string(),
        category,
        size: vsize,
        weight: Some(vsize * 4),
        fee: to_btc_from_sats(fee_sats),
        fee_rate,
        inputs,
        outputs,
        confirmations,
        work: work_estimate,
        work_unit: Some("TH".to_string()),
        timestamp: ts_mempool_time.or(block_time),
        rbf_signaled,
        status: ApiStatus {
            confirmed: confirmations > 0,
            block_height,
            block_hash,
            block_time,
        },
        vin: vin_json,
        vout: vout_json,
        version,
        locktime,
    }
}

pub async fn get_transactions() -> Json<Vec<ApiTransaction>> {
    let standard = Arc::new(connect_to_bitcoind());
    let committed = Arc::new(connect_to_cmempoold());

    // union of txids in both mempools
    let std_txids = standard.get_raw_mempool().unwrap_or_default();
    let cpool_txids = committed.get_raw_mempool().unwrap_or_default();
    let set: BTreeSet<_> = std_txids
        .into_iter()
        .chain(cpool_txids.into_iter())
        .collect();

    let mut results = stream::iter(set.into_iter())
        .map(|txid| {
            let standard = Arc::clone(&standard);
            let committed = Arc::clone(&committed);
            async move { build_tx(txid, standard.as_ref(), committed.as_ref()) }
        })
        .buffer_unordered(16)
        .collect::<Vec<_>>()
        .await;

    // Sort newest first by timestamp
    results.sort_by_key(|t| std::cmp::Reverse(t.timestamp.unwrap_or(0)));

    Json(results)
}

pub async fn commit_tx_to_cmempoold(
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

    let tx: Transaction = match standard.get_raw_transaction(&txid, None) {
        Ok(t) => t,
        Err(e) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"status":"error","error":format!("tx not found in bitcoind: {e}")})),
            )
        }
    };

    match committed.send_raw_transaction(&tx) {
        Ok(sent) => (
            StatusCode::OK,
            Json(json!({"status":"ok","txid":sent.to_string()})),
        ),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(json!({"status":"error","error":e.to_string()})),
        ),
    }
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

    // union of mempools
    let std_txids = standard.get_raw_mempool().unwrap_or_default();
    let cpool_txids = committed.get_raw_mempool().unwrap_or_default();
    let set: BTreeSet<_> = std_txids
        .into_iter()
        .chain(cpool_txids.into_iter())
        .collect();

    let mut total_vsize: u64 = 0;
    let mut total_fee_sats: u64 = 0;
    let mut histogram: BTreeMap<u64, u64> = BTreeMap::new(); // fee_rate_bucket -> total_vsize

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
                let fee_rate = (fee_sats as f64) / (vsize as f64); // sats/vB
                let bucket = fee_rate.round() as u64; // simple integer bucket
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

pub fn build_router() -> Router {
    Router::new()
        .route("/transactions", get(get_transactions))
        .route("/tx/{txid}", get(get_transaction_detail))
        .route("/mempool/info", get(get_mempool_info))
        .route("/beads/commit/{txid}", post(commit_tx_to_cmempoold))
        // Proposed set management
        .route("/proposed", get(list_proposed))
        .route("/proposed/{txid}", post(add_proposed))
        .route("/proposed/{txid}", delete(remove_proposed))
        // Scheduled set management
        .route("/scheduled", get(list_scheduled))
        .route("/scheduled/{txid}", post(add_scheduled))
        .route("/scheduled/{txid}", delete(remove_scheduled))
}

// ------- Proposed/Scheduled management endpoints -------

pub async fn list_proposed() -> Json<Vec<String>> {
    let set = PROPOSED.lock().unwrap();
    Json(set.iter().map(|t| t.to_string()).collect())
}

pub async fn add_proposed(Path(txid): Path<String>) -> (StatusCode, Json<serde_json::Value>) {
    match txid.parse::<Txid>() {
        Ok(t) => {
            PROPOSED.lock().unwrap().insert(t);
            (
                StatusCode::OK,
                Json(json!({"status":"ok","txid": t.to_string()})),
            )
        }
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(json!({"status":"error","error": format!("invalid txid: {e}")})),
        ),
    }
}

pub async fn remove_proposed(Path(txid): Path<String>) -> (StatusCode, Json<serde_json::Value>) {
    match txid.parse::<Txid>() {
        Ok(t) => {
            PROPOSED.lock().unwrap().remove(&t);
            (
                StatusCode::OK,
                Json(json!({"status":"ok","txid": t.to_string()})),
            )
        }
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(json!({"status":"error","error": format!("invalid txid: {e}")})),
        ),
    }
}

pub async fn list_scheduled() -> Json<Vec<String>> {
    let set = SCHEDULED.lock().unwrap();
    Json(set.iter().map(|t| t.to_string()).collect())
}

pub async fn add_scheduled(Path(txid): Path<String>) -> (StatusCode, Json<serde_json::Value>) {
    match txid.parse::<Txid>() {
        Ok(t) => {
            SCHEDULED.lock().unwrap().insert(t);
            (
                StatusCode::OK,
                Json(json!({"status":"ok","txid": t.to_string()})),
            )
        }
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(json!({"status":"error","error": format!("invalid txid: {e}")})),
        ),
    }
}

pub async fn remove_scheduled(Path(txid): Path<String>) -> (StatusCode, Json<serde_json::Value>) {
    match txid.parse::<Txid>() {
        Ok(t) => {
            SCHEDULED.lock().unwrap().remove(&t);
            (
                StatusCode::OK,
                Json(json!({"status":"ok","txid": t.to_string()})),
            )
        }
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(json!({"status":"error","error": format!("invalid txid: {e}")})),
        ),
    }
}
