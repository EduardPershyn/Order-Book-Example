import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { splitSignature } from "@ethersproject/bytes";

const allownessSig = async (tokenContract: Contract, account: Signer, spender: address, amount: number, deadline: Date, name: String) => {
    const contractAddr = await tokenContract.getAddress();
    const accountAddress = await account.getAddress();

    console.log("deadline: " + deadline);
    console.log("chain Id:", 31337);

    const nonce = Number(await tokenContract.nonces(accountAddress));
    console.log("nonce:", nonce);

    const typedData = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ],
      },
      primaryType: "Permit",
      domain: {
        name: name,
        version: "1",
        chainId: 31337,
        verifyingContract: contractAddr
      },
      message: {
        owner: accountAddress,
        spender: spender,
        value: amount,
        nonce: nonce,
        deadline: deadline
      }
    };

    //let signature = await signer.signMessage(JSON.stringify(typedData));
    let signature = await account.provider.send("eth_signTypedData_v4",
      [accountAddress, JSON.stringify(typedData)]
    );
    console.log(signature);

    const split = splitSignature(signature);
    console.log("r: ", split.r);
    console.log("s: ", split.s);
    console.log("v: ", split.v);

    return split;
};

const orderSig = async (account: Signer, sellToken_: address, sellAmount_: number, buyToken_: address, buyAmount_: number, deadline: Date,
                        bookAddr: address, orderType: String) => {
    const accountAddress = await account.getAddress();

    console.log("deadline: " + deadline);
    console.log("chain Id:", 31337);

    const typedData = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
        BuyOrder: [
          { name: "account", type: "address" },
          { name: "sellToken", type: "address" },
          { name: "sellAmount", type: "uint256" },
          { name: "buyToken", type: "address" },
          { name: "buyAmount", type: "uint256" },
          { name: "expireBy", type: "uint256" }
        ],
        SellOrder: [
          { name: "account", type: "address" },
          { name: "sellToken", type: "address" },
          { name: "sellAmount", type: "uint256" },
          { name: "buyToken", type: "address" },
          { name: "buyAmount", type: "uint256" },
          { name: "expireBy", type: "uint256" }
        ],
      },
      primaryType: orderType,
      domain: {
        name: "Exchange",
        version: "1",
        chainId: 31337,
        verifyingContract: bookAddr
      },
      message: {
        account: accountAddress,
        sellToken: sellToken_,
        sellAmount: sellAmount_,
        buyToken: buyToken_,
        buyAmount: buyAmount_,
        expireBy: deadline
      }
    };

    //let signature = await signer.signMessage(JSON.stringify(typedData));
    let signature = await account.provider.send("eth_signTypedData_v4",
      [accountAddress, JSON.stringify(typedData)]
    );
    console.log(signature);

    const split = splitSignature(signature);
    console.log("r: ", split.r);
    console.log("s: ", split.s);
    console.log("v: ", split.v);

    return split;
};

describe("OrderBook", function () {

  let accounts: Signer[];

  let tokenA: Contract;
  let tokenB: Contract;
  let orderBook: Contract;

  let tokenA_Address: address;
  let tokenB_Address: address;
  let bookAddress: address;

  beforeEach(async () => {
    accounts = await ethers.getSigners();

    const tokenFactory = await ethers.getContractFactory("SomeToken");
    tokenA = await tokenFactory.deploy("TokenA", "A");
    tokenB = await tokenFactory.deploy("TokenB", "B");

    orderBook = await (await ethers.getContractFactory("OrderBook")).deploy("Exchange");

    tokenA_Address = await tokenA.getAddress();
    tokenB_Address = await tokenB.getAddress();
    bookAddress = await orderBook.getAddress();

//     await tokenA.transfer(accounts[1], 100);
//     await tokenB.transfer(accounts[1], 50);
//     await tokenA.transfer(accounts[2], 10);
//     await tokenB.transfer(accounts[2], 5);
//
//     const bookAddress = await orderBook.getAddress();
//     const deadline = +new Date() + 60 * 60;
//     const sig = await allownessSig(tokenA, accounts[1], bookAddress, 100, deadline, "TokenA");
//     await tokenA.permit(accounts[1], bookAddress, 100, deadline, sig.v, sig.r, sig.s);

  });

    it("Sign and execute", async function () {
        const player1 = accounts[1];
        const player2 = accounts[2];

        const deadline = +new Date() + 60 * 60;
        const order2SellAmount = 100;
        const order2BuyAmount = 50;
        const order1BuyAmount = 10;
        const order1SellAmount = 5;

        await tokenA.transfer(player1, order1SellAmount);
        await tokenB.transfer(player2, order2SellAmount);

        const permitSig1 = await allownessSig(tokenA, player1, bookAddress, order1SellAmount, deadline, "TokenA");
        const permitSig2 = await allownessSig(tokenB, player2, bookAddress, order2SellAmount, deadline, "TokenB");

        const order1 = {
            account: player1,
            sellToken: tokenA_Address,
            sellAmount: order1SellAmount,
            buyToken: tokenB_Address,
            buyAmount: order1BuyAmount,
            expireBy: deadline
        }
        const order2 = {
            account: player2,
            sellToken: tokenB_Address,
            sellAmount: order2SellAmount,
            buyToken: tokenA_Address,
            buyAmount: order2BuyAmount,
            expireBy: deadline
        }
        const orderSig1 = await orderSig(player1,
                            tokenA_Address, order1SellAmount,
                            tokenB_Address, order1BuyAmount, deadline,
                            bookAddress, "SellOrder");
        const orderSig2 = await orderSig(player2,
                            tokenB_Address, order2SellAmount,
                            tokenA_Address, order2BuyAmount, deadline,
                            bookAddress, "BuyOrder");

        console.log("before exchange:");
        console.log(await tokenA.balanceOf(player1.address));
        console.log(await tokenB.balanceOf(player1.address));
        console.log(await tokenA.balanceOf(player2.address));
        console.log(await tokenB.balanceOf(player2.address));

        await orderBook.exec(order1, order2, permitSig1, permitSig2, orderSig1, orderSig2);

        console.log("after exchange:");
        console.log(await tokenA.balanceOf(player1.address));
        console.log(await tokenB.balanceOf(player1.address));
        console.log(await tokenA.balanceOf(player2.address));
        console.log(await tokenB.balanceOf(player2.address));

//         await tokenB.transfer(player2, 5);
//         const newOrder1 = {
//             account: player1,
//             sellToken: tokenA_Address,
//             sellAmount: 90,
//             buyToken: tokenB_Address,
//             buyAmount: 45,
//             expireBy: deadline
//         }
//         const newOrderSig1 = await orderSig(player1,
//                             tokenA_Address, 90,
//                             tokenB_Address, 45, deadline,
//                             bookAddress, "SellOrder");
//         const newPermitSig2 = await allownessSig(tokenB, player2, bookAddress, order2SellAmount, deadline, "TokenB");
//         await orderBook.exec(newOrder1, order2, permitSig1, newPermitSig2, newOrderSig1, orderSig2);
//
//         console.log("after exchange:");
//         console.log(await tokenA.balanceOf(player1.address));
//         console.log(await tokenB.balanceOf(player1.address));
//         console.log(await tokenA.balanceOf(player2.address));
//         console.log(await tokenB.balanceOf(player2.address));
    });
});
