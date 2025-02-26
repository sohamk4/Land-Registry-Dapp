const { exec } = require("child_process");
const chokidar = require("chokidar");

console.log("Watching Solidity files for changes...");

chokidar.watch("./contracts/**/*.sol").on("change", async () => {
    console.log("⚡ Solidity file changed! Compiling & Migrating...");
    
    exec("truffle migrate --reset --network development", (err, stdout, stderr) => {
        if (err) {
            console.error(`❌ Migration error: ${stderr}`);
        } else {
            console.log(`✅ Migration Success:\n${stdout}`);
        }
    });
});
