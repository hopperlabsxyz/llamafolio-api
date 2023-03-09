import { Balance, BalancesContext, Contract } from '@lib/adapter'
import { abi as erc20Abi } from '@lib/erc20'
import { sumBN } from '@lib/math'
import { Call, multicall } from '@lib/multicall'
import { Token } from '@lib/token'
import { isSuccess } from '@lib/type'
import { BigNumber } from 'ethers'

const abi = {
  earned: {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'earned',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  staked: {
    inputs: [
      { internalType: 'address', name: 'account', type: 'address' },
      { internalType: 'address', name: 'underlying', type: 'address' },
    ],
    name: 'staked',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
}

const EUL: Token = {
  chain: 'ethereum',
  address: '0xd9Fcd98c322942075A5C3860693e9f4f03AAE07b',
  decimals: 18,
  symbol: 'EUL',
}

export async function getETokenStakes(ctx: BalancesContext, stakers: Contract[]): Promise<Balance[]> {
  const balances: Balance[] = []

  const calls: Call[] = []
  for (let idx = 0; idx < stakers.length; idx++) {
    const staker = stakers[idx]
    calls.push({ target: staker.address, params: [ctx.address] })
  }

  const [balancesOfRes, earnedRewardsRes] = await Promise.all([
    multicall({ ctx, calls, abi: erc20Abi.balanceOf }),
    multicall({ ctx, calls, abi: abi.earned }),
  ])

  for (let idx = 0; idx < stakers.length; idx++) {
    const staker = stakers[idx]
    const token = staker.underlyings?.[0] as Contract
    const balanceOfRes = balancesOfRes[idx]
    const earnedRewardRes = earnedRewardsRes[idx]

    if (!isSuccess(balanceOfRes) || !isSuccess(earnedRewardRes) || !token) {
      continue
    }

    balances.push({
      ...token,
      amount: BigNumber.from(balanceOfRes.output),
      underlyings: [token.underlyings?.[0] as Contract],
      rewards: [{ ...EUL, amount: BigNumber.from(earnedRewardRes.output) }],
      category: 'stake',
    })
  }

  return balances
}

export async function getEULStakes(ctx: BalancesContext, staker: Contract, tokens: Token[]): Promise<Balance> {
  const calls: Call[] = []

  for (let idx = 0; idx < tokens.length; idx++) {
    const token = tokens[idx]
    calls.push({ target: staker.address, params: [ctx.address, token.address] })
  }

  const balancesOfRes = await multicall({ ctx, calls, abi: abi.staked })
  const eulBalanceOf = sumBN(balancesOfRes.filter(isSuccess).map((res) => BigNumber.from(res.output)))

  return {
    ...EUL,
    amount: eulBalanceOf,
    underlyings: undefined,
    rewards: undefined,
    category: 'stake',
  }
}