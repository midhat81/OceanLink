// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console} from "forge-std/src/Script.sol";
import {MockUSDT} from "../src/MockUSDT.sol";

contract MintUSDTScript is Script {
    // User addresses
    address constant USER_A = 0x9B55124d945B6E61c521adD7aA213433b3B1c8A2;
    address constant USER_B = 0x3aCA6E32BD6268bA2B834e6F23405E10575d19B2;
    address constant USER_C = 0x7cb386178d13e21093fdc988c7e77102d6464f3e;
    address constant USER_D = 0xe08745df99d3563821b633aa93ee02f7f883f25c;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address tokenAddress = vm.envAddress("TOKEN_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        MockUSDT token = MockUSDT(tokenAddress);
        uint256 mintAmount = 1_000_000_000e6; // 1 billion USDT (6 decimals)

        // Mint to A
        token.mint(USER_A, mintAmount);
        console.log("Minted", mintAmount, "USDT to A:", USER_A);
        console.log("A balance:", token.balanceOf(USER_A));

        // Mint to B
        token.mint(USER_B, mintAmount);
        console.log("Minted", mintAmount, "USDT to B:", USER_B);
        console.log("B balance:", token.balanceOf(USER_B));

        // Mint to C
        token.mint(USER_C, mintAmount);
        console.log("Minted", mintAmount, "USDT to C:", USER_C);
        console.log("C balance:", token.balanceOf(USER_C));

        // Mint to D
        token.mint(USER_D, mintAmount);
        console.log("Minted", mintAmount, "USDT to D:", USER_D);
        console.log("D balance:", token.balanceOf(USER_D));

        vm.stopBroadcast();
    }
}
