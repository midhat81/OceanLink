use serde::{de, Deserialize, Deserializer, Serialize, Serializer};
use std::{fmt, str::FromStr};
use uuid::Uuid;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Chain {
    Base,
    Arbitrum,
}

impl Chain {
    pub fn as_str(&self) -> &'static str {
        match self {
            Chain::Base => "Base",
            Chain::Arbitrum => "Arbitrum",
        }
    }

    pub fn all() -> [Chain; 2] {
        [Chain::Base, Chain::Arbitrum]
    }
}

impl fmt::Display for Chain {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl FromStr for Chain {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "base" => Ok(Chain::Base),
            "arbitrum" => Ok(Chain::Arbitrum),
            other => Err(format!("invalid chain '{other}'")),
        }
    }
}

impl Serialize for Chain {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.as_str())
    }
}

impl<'de> Deserialize<'de> for Chain {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        Chain::from_str(&s).map_err(de::Error::custom)
    }
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum IntentKind {
    Maker,
    Taker,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Intent {
    pub id: Uuid,
    pub user: String,
    pub from_chain: Chain,
    pub to_chain: Chain,
    pub amount: u64,
    pub kind: IntentKind,
    pub signature: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TransferPlanEntry {
    pub chain: Chain,
    pub from: String,
    pub to: String,
    pub amount: u64,
}

