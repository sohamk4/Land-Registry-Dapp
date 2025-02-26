const fs = require("fs");
const path = require("path");
const LandRegistry = artifacts.require("LandRegistry");
console.log("here");
module.exports = async function (deployer) {
    console.log("here1");
    await deployer.deploy(LandRegistry);
    console.log("here2");
    const contractData = require("../build/contracts/LandRegistry.json");
    console.log("here3");
    // Copy ABI to React
    const abiPath = path.resolve(__dirname, "../frontend/src/contracts/LandRegistry.json");
    console.log("here4");
    fs.writeFileSync(abiPath, JSON.stringify(contractData, null, 2));

    console.log("✅ ABI updated in React!");
};
