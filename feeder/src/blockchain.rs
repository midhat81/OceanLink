use crate::models::Chain;
use alloy::{
    primitives::{Address, U256},
    providers::{Provider, ProviderBuilder, ReqwestProvider},
    rpc::types::TransactionRequest,
    signers::{local::LocalWallet, Signer},
};
use std::str::FromStr;
use std::sync::Arc;

pub struct BlockchainClient {
    base_rpc: String,
    base_token_address: Address,
    b_private_key: String,
    c_private_key: String,
    d_private_key: String,
}

impl BlockchainClient {
    pub fn new(
        base_rpc: String,
        base_token_address: Address,
        b_private_key: String,
        c_private_key: String,
        d_private_key: String,
    ) -> Self {
        Self {
            base_rpc,
            base_token_address,
            b_private_key,
            c_private_key,
            d_private_key,
        }
    }

    pub async fn send_erc20_transfer(
        &self,
        from: &str,
        to: &str,
        amount: u64,
    ) -> Result<String, String> {
        let provider = ProviderBuilder::new()
            .on_http(ReqwestProvider::new(self.base_rpc.parse().map_err(|e| format!("Invalid RPC URL: {e}"))?));

        let private_key = match from {
            "0x3aca6e32bd6268ba2b834e6f23405e10575d19b2" => &self.b_private_key,
            "0x7cb386178d13e21093fdc988c7e77102d6464f3e" => &self.c_private_key,
            "0xe08745df99d3563821b633aa93ee02f7f883f25c" => &self.d_private_key,
            _ => return Err(format!("Unknown sender address: {from}")),
        };

        let wallet = LocalWallet::from_str(private_key)
            .map_err(|e| format!("Invalid private key: {e}"))?;

        let from_addr = Address::from_str(from)
            .map_err(|e| format!("Invalid from address: {e}"))?;
        let to_addr = Address::from_str(to)
            .map_err(|e| format!("Invalid to address: {e}"))?;

        // ERC20 transfer function signature: transfer(address to, uint256 amount)
        // Function selector: 0xa9059cbb
        let mut data = vec![0xa9, 0x05, 0x9c, 0xbb];
        
        // Encode to address (32 bytes, right-aligned)
        let mut to_bytes = [0u8; 32];
        to_bytes[12..].copy_from_slice(to_addr.as_slice());
        data.extend_from_slice(&to_bytes);
        
        // Encode amount (32 bytes)
        let amount_u256 = U256::from(amount);
        let mut amount_bytes = [0u8; 32];
        amount_u256.to_big_endian(&mut amount_bytes);
        data.extend_from_slice(&amount_bytes);

        let tx = TransactionRequest::default()
            .with_from(from_addr)
            .with_to(self.base_token_address)
            .with_data(data.into());

        let pending_tx = provider
            .send_transaction(tx)
            .await
            .map_err(|e| format!("Failed to send transaction: {e}"))?;

        let tx_hash = pending_tx.tx_hash();
        Ok(format!("{tx_hash:#x}"))
    }
}

pub type SharedBlockchainClient = Arc<BlockchainClient>;

