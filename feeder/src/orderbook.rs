use crate::balances::{self, Balances};
use crate::models::{Chain, Intent, IntentKind};
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

const MAKERS: [(&str, u64); 3] = [("B", 500_000), ("C", 300_000), ("D", 200_000)];
const MAKER_MINT_AMOUNT: u64 = 1_000_000_000;

pub struct AppState {
    pub balances: Balances,
    pub orderbook: Vec<Intent>,
}

pub type SharedState = Arc<Mutex<AppState>>;

pub fn init_state() -> SharedState {
    let mut state = AppState {
        balances: Balances::new(),
        orderbook: Vec::new(),
    };

    preload_balances(&mut state);
    preload_maker_intents(&mut state);

    Arc::new(Mutex::new(state))
}

fn preload_balances(state: &mut AppState) {
    for (maker, _) in MAKERS {
        balances::mint(&mut state.balances, Chain::Arbitrum, maker, MAKER_MINT_AMOUNT);
    }
}

fn preload_maker_intents(state: &mut AppState) {
    for (maker, amount) in MAKERS {
        let intent = Intent {
            id: Uuid::new_v4(),
            user: maker.to_string(),
            from_chain: Chain::Arbitrum,
            to_chain: Chain::Base,
            amount,
            kind: IntentKind::Maker,
            signature: "maker-intent".into(),
        };
        state.orderbook.push(intent);
    }
}

pub fn add_intent(state: &mut AppState, intent: Intent) {
    state.orderbook.push(intent);
}

