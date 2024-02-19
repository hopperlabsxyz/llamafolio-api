import { getKyberswapPairs } from '@adapters/kyberswap/common/pair'
import { getPoolsBalances } from '@adapters/uniswap-v3/common/pools'
import type { AdapterConfig, BaseContext, Contract, GetBalancesHandler } from '@lib/adapter'
import { resolveBalances } from '@lib/balance'
import { getPairsBalances } from '@lib/uniswap/v2/pair'

export const factory: Contract = {
  chain: 'arbitrum',
  address: '0xc7a590291e07b9fe9e64b86c58fd8fc764308c4a',
}

export const nonFungiblePositionManager: Contract = {
  chain: 'arbitrum',
  address: '0xe222fbe074a436145b255442d919e4e3a6c6a480',
}

export const getContracts = async (ctx: BaseContext, props: any) => {
  const offset = props.pairOffset || 0
  const limit = 100

  const { pairs, allPoolsLength } = await getKyberswapPairs({
    ctx,
    factoryAddress: '0x51E8D106C646cA58Caf32A47812e95887C071a62',
    offset,
    limit,
  })

  return {
    contracts: { pairs, nonFungiblePositionManager },
    revalidate: 60 * 60,
    revalidateProps: {
      pairOffset: Math.min(offset + limit, allPoolsLength),
    },
  }
}

export const getBalances: GetBalancesHandler<typeof getContracts> = async (ctx, contracts) => {
  const balances = await resolveBalances<typeof getContracts>(ctx, contracts, {
    pairs: getPairsBalances,
    nonFungiblePositionManager: (ctx, nonFungiblePositionManager) =>
      getPoolsBalances(ctx, nonFungiblePositionManager, factory),
  })

  return {
    groups: [{ balances }],
  }
}

export const config: AdapterConfig = {
  startDate: 1647475200,
}
