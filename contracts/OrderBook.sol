// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

// Uncomment this line to use console.log
import "hardhat/console.sol";

contract OrderBook is EIP712 {

    bytes32 private constant _BUY_ORDER_TYPEHASH =
        keccak256("BuyOrder(address account,address sellToken,uint256 sellAmount,address buyToken,uint256 buyAmount,uint256 expireBy)");
    bytes32 private constant _SELL_ORDER_TYPEHASH =
        keccak256("SellOrder(address account,address sellToken,uint256 sellAmount,address buyToken,uint256 buyAmount,uint256 expireBy)");

    struct Order {
        address account;
        address sellToken;
        uint256 sellAmount;
        address buyToken;
        uint256 buyAmount;
        uint256 expireBy;
    }

    constructor(string memory name) EIP712(name, "1") {
        console.log(block.chainid);

    }

//    struct SellOrder {
//        address account;
//        address sellToken;
//        uint256 sellAmount;
//        address buyToken;
//        uint256 buyAmount;
//        uint256 expireBy;
//    }
//
//    struct BuyOrder {
//        address account;
//        address buyToken;
//        uint256 buyAmount;
//        address sellToken;
//        uint256 sellAmount;
//        uint256 expireBy;
//    }

    struct Signature {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    function exec(Order calldata sellOrder, Order calldata buyOrder,
                    Signature calldata spendSig1, Signature calldata spendSig2,
                    Signature calldata orderSig1, Signature calldata orderSig2
    ) public {
        require(isOrderMatch(sellOrder, buyOrder), "OrderBook: Orders did not match!");
        ERC20Permit tokenA = ERC20Permit(sellOrder.sellToken);
        ERC20Permit tokenB = ERC20Permit(buyOrder.sellToken);

        //ERC20 allowance update
        console.log("h!-1");
        if (tokenA.allowance(sellOrder.account, address(this)) < sellOrder.sellAmount) {
            tokenA.permit(sellOrder.account, address(this), sellOrder.sellAmount, sellOrder.expireBy,
                spendSig1.v, spendSig1.r, spendSig1.s);
        }
        console.log("h!0");
        if (tokenB.allowance(buyOrder.account, address(this)) < buyOrder.sellAmount) {
            tokenB.permit(buyOrder.account, address(this), buyOrder.sellAmount, buyOrder.expireBy,
                spendSig2.v, spendSig2.r, spendSig2.s);
        }

        //Verify orders sigs
        console.log("h!1");
        verifyOrderSig(_SELL_ORDER_TYPEHASH, sellOrder, orderSig1);
        console.log("h!2");
        verifyOrderSig(_BUY_ORDER_TYPEHASH, buyOrder, orderSig2);
        console.log("h!3");

        //Execute orders
        if (sellOrder.sellAmount > buyOrder.buyAmount) {
            tokenA.transferFrom(sellOrder.account, buyOrder.account, buyOrder.buyAmount);
            tokenB.transferFrom(buyOrder.account, sellOrder.account, buyOrder.sellAmount);
        } else {
            tokenA.transferFrom(sellOrder.account, buyOrder.account, sellOrder.sellAmount);
            tokenB.transferFrom(buyOrder.account, sellOrder.account, sellOrder.buyAmount);
        }
    }

    function verifyOrderSig(bytes32 typeHash, Order memory forOrder, Signature memory sig) internal {
        bytes32 structHash = keccak256(abi.encode(typeHash, forOrder));
        bytes32 hash = _hashTypedDataV4(structHash);

        address signer = ECDSA.recover(hash, sig.v, sig.r, sig.s);
        require(signer == forOrder.account, "ERC20Permit: invalid signature");
    }

    function isOrderMatch(Order memory sellOrder, Order memory buyOrder) internal returns (bool) { //TODO check price
        return sellOrder.sellToken == buyOrder.buyToken &&
               sellOrder.buyToken == buyOrder.sellToken;
    }
}
