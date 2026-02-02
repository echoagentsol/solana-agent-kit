/**
 * Yields module for Solana Agent Kit
 * Integrates with SolanaYield API for DeFi yield optimization
 * Built by @jeeves_bot for Colosseum Agent Hackathon
 */

const API_BASE = 'https://solana-yield.vercel.app/api';

/**
 * Get real-time yields from Solana DeFi protocols
 * @param {Object} options
 * @param {string} [options.protocol] - Filter by protocol (kamino, drift, jito, marinade)
 * @param {string} [options.asset] - Filter by asset (SOL, USDC, etc.)
 * @param {number} [options.minApy] - Minimum APY threshold
 * @returns {Promise<Array>} Array of yield opportunities
 */
async function getYields(options = {}) {
  const params = new URLSearchParams();
  if (options.protocol) params.set('protocol', options.protocol);
  if (options.asset) params.set('asset', options.asset);
  if (options.minApy) params.set('minApy', options.minApy.toString());

  const url = `${API_BASE}/yields${params.toString() ? '?' + params : ''}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch yields: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Get top yields sorted by APY
 * @param {number} [limit=10] - Number of results
 * @returns {Promise<Array>}
 */
async function getTopYields(limit = 10) {
  const yields = await getYields();
  return yields
    .sort((a, b) => (b.apy || 0) - (a.apy || 0))
    .slice(0, limit);
}

/**
 * Optimize portfolio for best risk-adjusted yields
 * @param {Object} options
 * @param {Array} options.positions - Current positions [{protocol, asset, amount}]
 * @param {string} [options.riskProfile] - Risk tolerance: conservative, moderate, aggressive
 * @param {number} [options.maxPositions] - Maximum positions to hold
 * @returns {Promise<Object>} Optimization strategy with recommendations
 */
async function optimize(options) {
  const response = await fetch(`${API_BASE}/optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currentPositions: options.positions || [],
      riskProfile: options.riskProfile || 'moderate',
      maxPositions: options.maxPositions || 5
    })
  });

  if (!response.ok) {
    throw new Error(`Optimization failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Run autopilot analysis with AI reasoning
 * @param {Object} options
 * @param {Object} options.portfolio - Current portfolio state
 * @param {Object} [options.preferences] - User preferences
 * @returns {Promise<Object>} Decision with reasoning
 */
async function autopilot(options) {
  const response = await fetch(`${API_BASE}/autopilot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      portfolio: options.portfolio || {},
      preferences: options.preferences || { riskTolerance: 'moderate' }
    })
  });

  if (!response.ok) {
    throw new Error(`Autopilot failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Get supported protocols
 * @returns {Promise<Array>} List of supported DeFi protocols
 */
async function getProtocols() {
  return [
    { id: 'kamino', name: 'Kamino', types: ['lending', 'liquidity'] },
    { id: 'drift', name: 'Drift', types: ['lending', 'perpetuals'] },
    { id: 'jito', name: 'Jito', types: ['staking'] },
    { id: 'marinade', name: 'Marinade', types: ['staking'] },
    { id: 'raydium', name: 'Raydium', types: ['liquidity'] },
    { id: 'orca', name: 'Orca', types: ['liquidity'] },
    { id: 'marginfi', name: 'marginfi', types: ['lending'] },
    { id: 'solend', name: 'Solend', types: ['lending'] },
    { id: 'meteora', name: 'Meteora', types: ['liquidity'] }
  ];
}

/**
 * Find best yield for a specific asset
 * @param {string} asset - Token symbol (SOL, USDC, etc.)
 * @returns {Promise<Object|null>} Best yield opportunity or null
 */
async function findBestYield(asset) {
  const yields = await getYields({ asset });
  if (!yields.length) return null;
  return yields.reduce((best, curr) => 
    (curr.apy || 0) > (best.apy || 0) ? curr : best
  );
}

/**
 * Compare yields across protocols for an asset
 * @param {string} asset - Token symbol
 * @returns {Promise<Object>} Protocol comparison
 */
async function compareYields(asset) {
  const yields = await getYields({ asset });
  const byProtocol = {};
  
  for (const y of yields) {
    if (!byProtocol[y.protocol] || y.apy > byProtocol[y.protocol].apy) {
      byProtocol[y.protocol] = y;
    }
  }
  
  return {
    asset,
    protocols: Object.values(byProtocol).sort((a, b) => b.apy - a.apy),
    best: Object.values(byProtocol)[0] || null
  };
}

module.exports = {
  getYields,
  getTopYields,
  optimize,
  autopilot,
  getProtocols,
  findBestYield,
  compareYields,
  API_BASE
};
