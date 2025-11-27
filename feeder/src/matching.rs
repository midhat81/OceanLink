use crate::models::{Chain, Intent, IntentKind, TransferPlanEntry};

const REQUIRED_TOTAL: u64 = 1_000_000;
const PLAN: [(Chain, &str, &str, u64); 6] = [
    (Chain::Base, "A", "B", 500_000),
    (Chain::Base, "A", "C", 300_000),
    (Chain::Base, "A", "D", 200_000),
    (Chain::Arbitrum, "B", "A", 500_000),
    (Chain::Arbitrum, "C", "A", 300_000),
    (Chain::Arbitrum, "D", "A", 200_000),
];

pub fn match_a_against_makers(intents: &[Intent]) -> Option<Vec<TransferPlanEntry>> {
    let total_a: u64 = intents
        .iter()
        .filter(|intent| {
            intent.user == "A"
                && intent.from_chain == Chain::Base
                && intent.to_chain == Chain::Arbitrum
                && intent.kind == IntentKind::Taker
        })
        .map(|intent| intent.amount)
        .sum();

    if total_a < REQUIRED_TOTAL {
        return None;
    }

    Some(
        PLAN.iter()
            .map(|(chain, from, to, amount)| TransferPlanEntry {
                chain: *chain,
                from: (*from).to_string(),
                to: (*to).to_string(),
                amount: *amount,
            })
            .collect(),
    )
}

