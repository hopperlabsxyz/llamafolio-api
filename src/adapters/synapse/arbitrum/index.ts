import { BaseContext, Contract, GetBalancesHandler } from '@lib/adapter'
import { resolveBalances } from '@lib/balance'

import { getPoolsBalances, getPoolsContracts } from '../common/balance'

const MiniChef: Contract = {
  chain: 'arbitrum',
  address: '0x73186f2Cf2493f20836b17b21ae79fc12934E207',
}

export const getContracts = async (ctx: BaseContext) => {
  const pools = await getPoolsContracts(ctx, MiniChef)

  return {
    contracts: { pools },
  }
}

export const getBalances: GetBalancesHandler<typeof getContracts> = async (ctx, contracts) => {
  const balances = await resolveBalances<typeof getContracts>(ctx, contracts, {
    pools: (...args) => getPoolsBalances(...args, MiniChef),
  })

  return {
    balances,
  }
}