import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('Deploying contracts with the account:', deployer.address);

  console.log('Account balance:', (await deployer.getBalance()).toString());

  const factory = await ethers.getContractFactory('DaoPoll');
  const dao = await factory.deploy(process.env.OWNER_ADDRESS, process.env.ERC20_TOKEN_ADDRESS, 100, 180);

  console.log('Dao address:', dao.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
