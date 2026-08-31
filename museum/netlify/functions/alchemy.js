exports.handler = async function(event) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=60'
  };

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Missing ALCHEMY_API_KEY environment variable' })
    };
  }

  const params = event.queryStringParameters || {};
  const action = String(params.action || '').trim();
  const contractAddress = String(params.contractAddress || '').trim();
  const tokenId = String(params.tokenId || '').trim();
  const owner = String(params.owner || '').trim();
  const pageKey = String(params.pageKey || '').trim();
  const network = String(params.network || 'eth-mainnet').trim();
  const pageSize = Math.max(1, Math.min(parseInt(params.pageSize || '50', 10) || 50, 100));

  try {
    let upstreamUrl = '';

    if (action === 'metadata') {
      if (!contractAddress || !tokenId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'contractAddress and tokenId are required' })
        };
      }
      upstreamUrl = `https://${network}.g.alchemy.com/nft/v3/${apiKey}/getNFTMetadata?contractAddress=${encodeURIComponent(contractAddress)}&tokenId=${encodeURIComponent(tokenId)}&refreshCache=false`;
    } else if (action === 'wallet') {
      if (!owner || !contractAddress) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'owner and contractAddress are required' })
        };
      }
      const suffix = pageKey ? `&pageKey=${encodeURIComponent(pageKey)}` : '';
      upstreamUrl = `https://${network}.g.alchemy.com/nft/v3/${apiKey}/getNFTsForOwner?owner=${encodeURIComponent(owner)}&contractAddresses[]=${encodeURIComponent(contractAddress)}&withMetadata=true&pageSize=${pageSize}${suffix}`;
    } else if (action === 'contractMetadata') {
      if (!contractAddress) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'contractAddress is required' })
        };
      }
      upstreamUrl = `https://${network}.g.alchemy.com/nft/v3/${apiKey}/getContractMetadata?contractAddress=${encodeURIComponent(contractAddress)}`;
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Unsupported action' })
      };
    }

    const response = await fetch(upstreamUrl, {
      headers: { accept: 'application/json' }
    });
    const text = await response.text();

    return {
      statusCode: response.status,
      headers,
      body: text
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Unknown server error' })
    };
  }
};
