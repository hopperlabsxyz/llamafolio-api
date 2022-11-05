import { Contract, GetBalancesHandler } from "@lib/adapter";
import {
  getLendingPoolContracts,
  getLendingPoolBalances,
  getLendingPoolHealthFactor,
} from "@lib/aave/v2/lending";
import {
  getStakeBalances,
  getStakeBalancerPoolBalances,
} from "@adapters/aave/v2/common/stake";
import { getLendingRewardsBalances } from "@adapters/aave/v2/common/rewards";

const AAVE: Contract = {
  name: "Aave Token",
  address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
  chain: "ethereum",
  symbol: "AAVE",
  decimals: 18,
};

const ABPT: Contract = {
  name: "Aave Balance Pool Token",
  address: "0x41A08648C3766F9F9d85598fF102a08f4ef84F84",
  chain: "ethereum",
  symbol: "ABPT",
  decimals: 18,
};

const stkAAVE: Contract = {
  name: "Staked Aave",
  address: "0x4da27a545c0c5b758a6ba100e3a049001de870f5",
  chain: "ethereum",
  symbol: "stkAAVE",
  decimals: 18,
  underlyings: [AAVE],
  rewards: [AAVE],
};

const stkABPT: Contract = {
  name: "Staked Aave Balance Pool Token",
  address: "0xa1116930326d21fb917d5a27f1e9943a9595fb47",
  chain: "ethereum",
  symbol: "stkABPT",
  decimals: 18,
  underlyings: [ABPT],
};

const lendingPool: Contract = {
  name: "Lending Pool",
  address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
  chain: "ethereum",
};

export const getContracts = async () => {
  const poolsEthereum = await getLendingPoolContracts(
    "ethereum",
    lendingPool.address
  );

  return {
    contracts: {
      poolsEthereum,
      stkAAVE,
      stkABPT,
    },
  };
};

export const getBalances: GetBalancesHandler<typeof getContracts> = async (
  ctx,
  { poolsEthereum, stkAAVE, stkABPT }
) => {
  const [
    lendingPoolBalances,
    rewardsPoolBalances,
    healthFactor,
    stakeBalances,
    stakeBalancerBalances,
  ] = await Promise.all([
    getLendingPoolBalances(ctx, "ethereum", poolsEthereum || [], lendingPool),
    getLendingRewardsBalances(
      ctx,
      "ethereum",
      poolsEthereum || [],
      lendingPool
    ),
    getLendingPoolHealthFactor(ctx, "ethereum", lendingPool),

    getStakeBalances(ctx, "ethereum", stkAAVE),
    getStakeBalancerPoolBalances(ctx, "ethereum", stkABPT),
  ]);

  return {
    balances: [
      ...lendingPoolBalances,
      ...rewardsPoolBalances,
      ...stakeBalances,
      ...stakeBalancerBalances,
    ],
    ethereum: {
      healthFactor,
    },
  };
};