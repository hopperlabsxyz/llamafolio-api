import { BigNumber, ethers } from "ethers";
import { Chain, providers } from "@defillama/sdk/build/general";
import { BaseContext, Contract } from "@lib/adapter";
import { getERC20Details, getERC20BalanceOf } from "@lib/erc20";
import { multicall } from "@lib/multicall";
import ComptrollerABI from "./abis/Comptroller.json";
import { Token } from "@lib/token";
import { isNotNullish } from "@lib/type";
import { BN_TEN } from "@lib/math";

export async function getMarketsContracts(
  chain: Chain,
  { comptrollerAddress }: { comptrollerAddress: string }
) {
  const provider = providers[chain];

  const comptroller = new ethers.Contract(
    comptrollerAddress,
    ComptrollerABI,
    provider
  );

  const cTokensAddresses: string[] = await comptroller.getAllMarkets();

  const [cTokens, underlyingTokensAddressesRes] = await Promise.all([
    getERC20Details(chain, cTokensAddresses),

    multicall({
      chain,
      calls: cTokensAddresses.map((address) => ({
        target: address,
        params: [],
      })),
      abi: {
        constant: true,
        inputs: [],
        name: "underlying",
        outputs: [{ name: "", type: "address" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
    }),
  ]);

  const underlyingTokensAddresses = underlyingTokensAddressesRes
    .filter((res) => res.success)
    .map((res) => res.output);

  const underlyingTokens = await getERC20Details(
    chain,
    underlyingTokensAddresses
  );
  const underlyingTokenByAddress: { [key: string]: Token } = {};
  for (const underlyingToken of underlyingTokens) {
    underlyingToken.address = underlyingToken.address.toLowerCase();
    underlyingTokenByAddress[underlyingToken.address] = underlyingToken;
  }

  return cTokens
    .map((token, i) => {
      const underlyingTokenAddress =
        underlyingTokensAddressesRes[i].output?.toLowerCase();
      let underlyingToken = underlyingTokenByAddress[underlyingTokenAddress];

      // cETH -> WETH
      if (
        chain === "ethereum" &&
        token.address.toLowerCase() ===
          "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5"
      ) {
        underlyingToken = {
          chain,
          symbol: "WETH",
          decimals: 18,
          address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        };
      }

      if (!underlyingToken) {
        return null;
      }

      return {
        ...token,
        priceSubstitute: underlyingToken.address,
        underlyings: [underlyingToken],
      };
    })
    .filter(isNotNullish);
}

export async function getMarketsBalances(
  ctx: BaseContext,
  chain: Chain,
  contracts: Contract[]
) {
  const cTokenByAddress: { [key: string]: Contract } = {};
  for (const contract of contracts) {
    cTokenByAddress[contract.address] = contract;
  }

  const [
    cTokensBalances,
    cTokensBorrowBalanceCurrentRes,
    cTokensExchangeRateCurrentRes,
  ] = await Promise.all([
    getERC20BalanceOf(ctx, chain, contracts),

    multicall({
      chain,
      calls: contracts.map((token) => ({
        target: token.address,
        params: [ctx.address],
      })),
      abi: {
        constant: false,
        inputs: [{ internalType: "address", name: "account", type: "address" }],
        name: "borrowBalanceCurrent",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
      },
    }),

    multicall({
      chain,
      calls: contracts.map((token) => ({
        target: token.address,
        params: [],
      })),
      abi: {
        constant: false,
        inputs: [],
        name: "exchangeRateCurrent",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
      },
    }),
  ]);

  const exchangeRateCurrentBycTokenAddress: { [key: string]: BigNumber } = {};
  for (const res of cTokensExchangeRateCurrentRes) {
    if (!res.success) {
      continue;
    }

    exchangeRateCurrentBycTokenAddress[res.input.target] = BigNumber.from(
      res.output
    );
  }

  const cTokensSupplyBalances = cTokensBalances
    .filter((bal) => exchangeRateCurrentBycTokenAddress[bal.address])
    .map((bal) => {
      // add amount
      const amount = bal.amount
        .mul(exchangeRateCurrentBycTokenAddress[bal.address])
        .div(BN_TEN.pow(bal.underlyings[0].decimals + 10));
      bal.underlyings[0].amount = amount;

      return {
        ...bal,
        amount,
        category: "lend",
      };
    });

  const cTokensBorrowBalances = cTokensBorrowBalanceCurrentRes
    .filter((res) => res.success)
    .map((res) => {
      const cToken = cTokenByAddress[res.input.target];
      if (!cToken) {
        return null;
      }

      // add amount
      const amount = BigNumber.from(res.output);
      cToken.underlyings[0].amount = amount;

      return {
        ...cToken,
        amount,
        decimals: cToken.underlyings[0].decimals,
        category: "borrow",
        type: "debt",
      };
    })
    .filter(isNotNullish);

  return [...cTokensSupplyBalances, ...cTokensBorrowBalances];
}