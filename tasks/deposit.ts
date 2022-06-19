import { task } from "hardhat/config";

task("deposit", "Deposit tokens on dao contract")
  .addParam('dao', "The address of the dao contract")
  .addParam('amount', "Amount of the tonkens")
  .setAction(async (taskArgs, hre) => {
    const daoAddress = taskArgs.dao;
    const amount = taskArgs.amount;
    const daoFactory = await hre.ethers.getContractFactory('DaoPoll');
    const dao = daoFactory.attach(daoAddress);
    await dao.deposit(amount);

    console.log("Done");
  });