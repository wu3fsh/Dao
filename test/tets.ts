import { ethers, network } from "hardhat";
import { Contract, ContractFactory, Signature, Signer } from "ethers";
import { expect } from "chai";
import { Interface } from "ethers/lib/utils";

interface ProposalInfo {
  signature: string,
  recipient: string,
  description: string,
  votesFor: number,
  votesAgainst: number,
  startDateTimestamp: number,
  isDone: boolean
}

describe("Dao", function () {
    const name: string = "Test Coin";
    const symbol: string = "Test Coin";
    const decimals: number = 2;
    const totalSupply: number = 100;
    const minimumQuorum: number = 1;
    const newMinimumQuorum: number = 10;
    const debatingDuration: number = 5;
    let owner: Signer;
    let addresses: Signer[];
    let erc20tokensFactory: ContractFactory;
    let daoFactory: ContractFactory;
    let daoPoll: Contract;
    let erc20token: Contract;
  
    beforeEach(async function () {
      [owner, ...addresses] = await ethers.getSigners();
      erc20tokensFactory = await ethers.getContractFactory('ERC20Token');
      erc20token = await erc20tokensFactory.connect(owner).deploy(name, symbol, decimals, totalSupply);
  
      daoFactory = await ethers.getContractFactory('DaoPoll');
      daoPoll = await daoFactory.deploy(await owner.getAddress(), erc20token.address, minimumQuorum, debatingDuration);
    });

    it("should get expected info", async function () {
      expect(await daoPoll.getChairman()).to.equal(await owner.getAddress());
      expect(await daoPoll.getVoteToken()).to.equal(erc20token.address);
      expect(await daoPoll.getMinimumQuorum()).to.equal(minimumQuorum);
      expect(await daoPoll.getDebatingPeriodDurationSec()).to.equal(debatingDuration);
      expect(await daoPoll.getProposalCount()).to.equal(1);
    });

    it("should deposit tokens to vote", async function () {
      const balance = await erc20token.balanceOf(owner.getAddress());
      expect(await erc20token.balanceOf(daoPoll.address)).to.equal(0);
      const amount = 100;
      await erc20token.approve(daoPoll.address, amount);
      await daoPoll.deposit(amount);
      expect(await erc20token.balanceOf(daoPoll.address)).to.equal(amount);
      expect(await erc20token.balanceOf(owner.getAddress())).to.equal(balance - amount);
    });

    
    it("should add a new proposal", async function () {
      expect(await daoPoll.getProposalCount()).to.equal(1);
      const signature: string = getCallData(newMinimumQuorum);
      const recipientAddress: string = daoPoll.address;
      const description: string = "new proposal";
      await daoPoll.addProposal(signature, recipientAddress, description);
      expect(await daoPoll.getProposalCount()).to.equal(2);
      const porposalInfo: ProposalInfo  =  await daoPoll.getProposalInfo(1);
      expect(porposalInfo.signature).to.equal(signature);
      expect(porposalInfo.recipient).to.equal(recipientAddress);
      expect(porposalInfo.description).to.equal(description);
    });

    it("should throw an exception if it isn't owner", async function () {
      expect(await daoPoll.getProposalCount()).to.equal(1);
      const signature: string = getCallData(newMinimumQuorum);
      const recipientAddress: string = daoPoll.address;
      const description: string = "new proposal";

      try {
        expect(await daoPoll.connect(addresses[1]).addProposal(signature, recipientAddress, description)).to.throw();
      } catch (error: unknown) {
        expect(error instanceof Error ? error.message : "").to.have.string("Only the chairman of the dao contract can perform this operation");
      }
    });

    it("should vote for a proposal", async function () {
      const amount = 100;
      await erc20token.approve(daoPoll.address, amount);
      await daoPoll.deposit(amount);
      await daoPoll.addProposal(getCallData(newMinimumQuorum), daoPoll.address, "new proposal");
      const proposalId: number = 1;
      await daoPoll.vote(proposalId, true);
      const porposalInfo: ProposalInfo = await daoPoll.getProposalInfo(proposalId);
      expect(porposalInfo.votesFor).to.equal(amount);
      expect(porposalInfo.votesAgainst).to.equal(0);
    });

    it("should vote for multiple proposals", async function () {
      const amount = 100;
      await erc20token.approve(daoPoll.address, amount);
      await daoPoll.deposit(amount);
      await daoPoll.addProposal(getCallData(newMinimumQuorum), daoPoll.address, "proposal");
      const proposalId: number = 1;
      const anotherProposalId: number = 2;
      await daoPoll.addProposal(getCallData(newMinimumQuorum), daoPoll.address, "new proposal");

      await daoPoll.vote(anotherProposalId, true);
      await daoPoll.vote(proposalId, true);

      const porposalInfo: ProposalInfo = await daoPoll.getProposalInfo(proposalId);
      expect(porposalInfo.votesFor).to.equal(amount);
      expect(porposalInfo.votesAgainst).to.equal(0);

      const anotherPorposalInfo: ProposalInfo = await daoPoll.getProposalInfo(anotherProposalId);
      expect(anotherPorposalInfo.votesFor).to.equal(amount);
      expect(anotherPorposalInfo.votesAgainst).to.equal(0);
    });

    it("should vote against a proposal", async function () {
      const amount = 100;
      await erc20token.approve(daoPoll.address, amount);
      await daoPoll.deposit(amount);
      await daoPoll.addProposal(getCallData(newMinimumQuorum), daoPoll.address, "new proposal");
      const proposalId: number = 1;
      await daoPoll.vote(proposalId, false);
      const porposalInfo: ProposalInfo = await daoPoll.getProposalInfo(proposalId);
      expect(porposalInfo.votesFor).to.equal(0);
      expect(porposalInfo.votesAgainst).to.equal(amount);
    });

    it("should throw an exception if the user doesn't have tokens to vote", async function () {
      await daoPoll.addProposal(getCallData(newMinimumQuorum), daoPoll.address, "new proposal");
      const proposalId: number = 1;
        
      try {
        expect(await daoPoll.vote(proposalId, true)).to.throw();
      } catch (error: unknown) {
        expect(error instanceof Error ? error.message : "").to.have.string("The user doesn't have tokens to vote");
      }
    });

    it("should throw an exception if the voter has already voted", async function () {
      const amount = 100;
      await erc20token.approve(daoPoll.address, amount);
      await daoPoll.deposit(amount);
      await daoPoll.addProposal(getCallData(newMinimumQuorum), daoPoll.address, "new proposal");
      const proposalId: number = 1;
      await daoPoll.vote(proposalId, true);
        
      try {
        expect(await daoPoll.vote(proposalId, true)).to.throw();
      } catch (error: unknown) {
        expect(error instanceof Error ? error.message : "").to.have.string("The voter has already voted");
      }
    });
    
    it("should throw an exception if the proposal has been already done", async function () {
      const amount = 100;
      await erc20token.approve(daoPoll.address, amount);
      await daoPoll.deposit(amount);
      await daoPoll.addProposal(getCallData(newMinimumQuorum), daoPoll.address, "new proposal");
      const proposalId: number = 1;
      await daoPoll.vote(proposalId, true);
      await network.provider.send("evm_increaseTime", [10]);

      await daoPoll.finishProposal(proposalId);

      await erc20token.connect(owner).transfer(addresses[1].getAddress(), amount);
      await erc20token.connect(addresses[1]).approve(daoPoll.address, amount);
      await daoPoll.connect(addresses[1]).deposit(amount);
        
      try {
        expect(await daoPoll.connect(addresses[1]).vote(proposalId, true)).to.throw();
      } catch (error: unknown) {
        expect(error instanceof Error ? error.message : "").to.have.string("The proposal has been already done");
      }
    });

    it("should successfuly finish a proposal poll", async function () {
      const amount = 100;
      await erc20token.approve(daoPoll.address, amount);
      await daoPoll.deposit(amount);
      await daoPoll.addProposal(getCallData(newMinimumQuorum), daoPoll.address, "new proposal");
      const proposalId: number = 1;
      await daoPoll.vote(proposalId, true);
      await network.provider.send("evm_increaseTime", [10]);
      let porposalInfo: ProposalInfo = await daoPoll.getProposalInfo(proposalId);
      expect(porposalInfo.isDone).to.equal(false);
      expect(await daoPoll.getMinimumQuorum()).to.equal(minimumQuorum);
      await daoPoll.finishProposal(proposalId);

      expect(await daoPoll.getMinimumQuorum()).to.equal(newMinimumQuorum);

      porposalInfo = await daoPoll.getProposalInfo(proposalId);
      expect(porposalInfo.isDone).to.equal(true);
    });

    it("should unsuccessfuly finish a proposal poll", async function () {
      const amount = 100;
      await erc20token.approve(daoPoll.address, amount);
      await daoPoll.deposit(amount);
      await daoPoll.addProposal(getCallData(newMinimumQuorum), daoPoll.address, "new proposal");
      const proposalId: number = 1;
      await daoPoll.vote(proposalId, false);
      await network.provider.send("evm_increaseTime", [10]);
      let porposalInfo: ProposalInfo = await daoPoll.getProposalInfo(proposalId);
      expect(porposalInfo.isDone).to.equal(false);
      expect(await daoPoll.getMinimumQuorum()).to.equal(minimumQuorum);
      await daoPoll.finishProposal(proposalId);

      porposalInfo = await daoPoll.getProposalInfo(proposalId);
      expect(porposalInfo.isDone).to.equal(true);
    });
    
    it("should throw an exception on finishing if the proposal has been already done", async function () {
      const amount = 100;
      await erc20token.approve(daoPoll.address, amount);
      await daoPoll.deposit(amount);
      await daoPoll.addProposal(getCallData(newMinimumQuorum), daoPoll.address, "new proposal");
      const proposalId: number = 1;
      await daoPoll.vote(proposalId, false);
      await network.provider.send("evm_increaseTime", [10]);
      let porposalInfo: ProposalInfo = await daoPoll.getProposalInfo(proposalId);
      expect(porposalInfo.isDone).to.equal(false);
      expect(await daoPoll.getMinimumQuorum()).to.equal(minimumQuorum);
      await daoPoll.finishProposal(proposalId);
        
      try {
        expect(await daoPoll.finishProposal(proposalId)).to.throw();
      } catch (error: unknown) {
        expect(error instanceof Error ? error.message : "").to.have.string("The proposal has been already done");
      }
    });

    it("should throw an exception on finishing if there isn't enough votes", async function () {
      const amount = 1;
      const anotherMinimumQuorum = 10;
      const anotherDaoPoll: Contract = await daoFactory.deploy(await owner.getAddress(), erc20token.address, anotherMinimumQuorum, debatingDuration);
      await erc20token.approve(anotherDaoPoll.address, amount);
      await anotherDaoPoll.deposit(amount);
      await anotherDaoPoll.addProposal(getCallData(newMinimumQuorum), anotherDaoPoll.address, "new proposal");
      const proposalId: number = 1;
      await anotherDaoPoll.vote(proposalId, false);
      await network.provider.send("evm_increaseTime", [10]);
      let porposalInfo: ProposalInfo = await anotherDaoPoll.getProposalInfo(proposalId);
      expect(porposalInfo.isDone).to.equal(false);

      try {
        expect(await anotherDaoPoll.finishProposal(proposalId)).to.throw();
      } catch (error: unknown) {
        expect(error instanceof Error ? error.message : "").to.have.string("Not enough votes");
      }
    });

    it("should throw an exception on finishing if the poll hasn't finished yet", async function () {
      const amount = 100;
      const anotherDebatingDuration = 10;
      const anotherDaoPoll: Contract = await daoFactory.deploy(await owner.getAddress(), erc20token.address, minimumQuorum, anotherDebatingDuration);
      await erc20token.approve(anotherDaoPoll.address, amount);
      await anotherDaoPoll.deposit(amount);
      await anotherDaoPoll.addProposal(getCallData(newMinimumQuorum), anotherDaoPoll.address, "new proposal");
      const proposalId: number = 1;
      await anotherDaoPoll.vote(proposalId, false);
      let porposalInfo: ProposalInfo = await anotherDaoPoll.getProposalInfo(proposalId);
      expect(porposalInfo.isDone).to.equal(false);

      try {
        expect(await anotherDaoPoll.finishProposal(proposalId)).to.throw();
      } catch (error: unknown) {
        expect(error instanceof Error ? error.message : "").to.have.string("The poll hasn't finished yet");
      }
    });

    it("should throw an exception on finishing if it isn't dao contract", async function () {
      try {
        expect(await daoPoll.setMinimumQuorum(1)).to.throw();
      } catch (error: unknown) {
        expect(error instanceof Error ? error.message : "").to.have.string("Only the dao contract can perform this operation");
      }
    });

    it("should withdraw tokens", async function () {
      const amount = 100;
      await erc20token.approve(daoPoll.address, amount);
      await daoPoll.deposit(amount);
      await daoPoll.addProposal(getCallData(newMinimumQuorum), daoPoll.address, "new proposal");
      const proposalId: number = 1;
      await daoPoll.vote(proposalId, true);
      await network.provider.send("evm_increaseTime", [10]);
      let porposalInfo: ProposalInfo = await daoPoll.getProposalInfo(proposalId);
      expect(porposalInfo.isDone).to.equal(false);
      expect(await daoPoll.getMinimumQuorum()).to.equal(minimumQuorum);
      await daoPoll.finishProposal(proposalId);

      const balance = await erc20token.balanceOf(owner.getAddress());
      expect(await erc20token.balanceOf(daoPoll.address)).to.equal(amount);
      const anotherAmount = 50;
      await daoPoll.withdraw(anotherAmount);
      expect(await erc20token.balanceOf(daoPoll.address)).to.equal(+amount - (+anotherAmount));
      expect(await erc20token.balanceOf(owner.getAddress())).to.equal(+balance + (+anotherAmount));
    });

    it("should throw an exception on finishing if the voter is still in ongoing proposal polls", async function () {
      const amount = 100;
      await erc20token.approve(daoPoll.address, amount);
      await daoPoll.deposit(amount);
      await daoPoll.addProposal(getCallData(newMinimumQuorum), daoPoll.address, "new proposal");
      const proposalId: number = 1;
      await daoPoll.vote(proposalId, true);

      try {
        expect(await daoPoll.withdraw(amount)).to.throw();
      } catch (error: unknown) {
        expect(error instanceof Error ? error.message : "").to.have.string("The voter is still in ongoing proposal polls");
      }
    });

    it("should throw an exception on finishing if the voter doesn't have enough tokens to withdraw", async function () {
      const amount = 100;
      await erc20token.approve(daoPoll.address, amount);
      await daoPoll.deposit(amount);
      await daoPoll.addProposal(getCallData(newMinimumQuorum), daoPoll.address, "new proposal");
      const proposalId: number = 1;
      await daoPoll.vote(proposalId, true);
      await network.provider.send("evm_increaseTime", [10]);
      let porposalInfo: ProposalInfo = await daoPoll.getProposalInfo(proposalId);
      expect(porposalInfo.isDone).to.equal(false);
      expect(await daoPoll.getMinimumQuorum()).to.equal(minimumQuorum);
      await daoPoll.finishProposal(proposalId);

      try {
        expect(await daoPoll.withdraw(amount + 1)).to.throw();
      } catch (error: unknown) {
        expect(error instanceof Error ? error.message : "").to.have.string("The voter doesn't have enough tokens to withdraw");
      }
    });
});  

function getCallData(newQuorum: number): string {
  const iface: Interface = new ethers.utils.Interface([{"inputs": [
    {
      "internalType": "uint256",
      "name": "amount",
      "type": "uint256"
    }
  ],
  "name": "setMinimumQuorum",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"}]);
  return iface.encodeFunctionData('setMinimumQuorum', [newQuorum]);
}