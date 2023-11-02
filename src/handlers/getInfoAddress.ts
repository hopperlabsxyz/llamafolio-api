import { client } from '@db/clickhouse'
import { badRequest, serverError, success } from '@handlers/response'
import { isHex } from '@lib/contract'
import { parseAddresses, unixFromDateTime } from '@lib/fmt'
import type { APIGatewayProxyHandler } from 'aws-lambda'

interface AddressInfoResponse {
  data: {
    activeSince?: number
  }
}

/**
 * Get address info
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  const addresses = parseAddresses(event.pathParameters?.address || '')
  if (addresses.length === 0) {
    return badRequest('Missing address parameter')
  }

  if (addresses.some((address) => !isHex(address))) {
    return badRequest('Invalid address parameter, expected hex')
  }

  try {
    const queryRes = await client.query({
      query: `
        SELECT min("timestamp") as "timestamp" from evm_indexer.transactions_history_agg
        WHERE "target" IN {addresses: Array(String)}
        SETTINGS optimize_read_in_order=1;
      `,
      query_params: {
        addresses: addresses,
      },
    })

    const res = (await queryRes.json()) as {
      data: { timestamp: string }[]
    }

    const response: AddressInfoResponse = {
      data: { activeSince: res.data[0]?.timestamp ? unixFromDateTime(res.data[0].timestamp) : undefined },
    }

    return success(response, { maxAge: 24 * 60 * 60 })
  } catch (error) {
    console.error('Failed to get address info', { error })
    return serverError('Failed to get address info')
  }
}
