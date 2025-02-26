import React, { useState, useEffect } from "react";
import Web3 from "web3";
import { ethers } from "ethers";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer, toast } from "react-toastify";
import contractData from "../contracts/LandRegistry.json";
import axios from "axios";

const CONTRACT_ADDRESS = contractData.networks[1337]?.address || "";
const CONTRACT_ABI = contractData.abi;
const API_KEY = "774412af0849ba9bf5f5";
const SECRET_KEY = "da8ff56a076fb5ed2bbaba5b404b25801a250509d08fd60d68c361867ca88bd8";

const Landregs = () => {
    const [account, setAccount] = useState(null);
    const [lands, setLands] = useState([]);
    const [contract, setContract] = useState(null);
    const [web3, setWeb3] = useState(null);
    const [landData, setLandData] = useState({ location: "", price: "", document: null });
    const [exfile, setExfile] = useState(null);
    const [showInput, setShowInput] = useState(false);
    const [maxTokens, setMaxTokens] = useState("");
    const [nftTokens, setNftTokens] = useState(0);
    const [filterOption, setFilterOption] = useState("all");

    useEffect(() => {
        loadBlockchainData();
    }, []);

    const loadBlockchainData = async () => {
        if (window.ethereum) {
            const web3Instance = new Web3(window.ethereum);
            setWeb3(web3Instance);

            await window.ethereum.request({ method: "eth_requestAccounts" });
            const accounts = await web3Instance.eth.getAccounts();
            setAccount(accounts[0]);

            const contractInstance = new web3Instance.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
            setContract(contractInstance);

            fetchLands(contractInstance);
        } else {
            toast.error("MetaMask not detected! Please install it.");
        }
    };

    const fetchLands = async (contractInstance) => {
        try {
            const landCount = await contractInstance.methods.landCount().call();
            const landsArray = [];
            for (let i = 1; i <= landCount; i++) {
                const land = await contractInstance.methods.getLand(i).call();
                landsArray.push({
                    id: i,
                    owner: land[0],
                    location: land[1],
                    price: land[2],
                    pricePerToken: land[3],
                    isAvailable: land[4],
                    cid: land[5],
                    tokenCount: land[6],
                    tokenIds: land[7]
                });
            }
            setLands(landsArray);
        } catch (error) {
            console.error("Error fetching lands:", error);
            toast.error("Failed to load registered lands.");
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.type !== "application/pdf") {
            toast.error("Only PDF files are allowed!");
            e.target.value = null;
            return;
        }
        setLandData({ ...landData, document: file });

        const formData = new FormData();
        formData.append("file", file);

        try {
            const flaskResponse = await axios.post("http://192.168.0.105:5000/extract-qr", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            if (flaskResponse.status === 200 && flaskResponse.data.data) {
                setExfile(flaskResponse.data.data);
                toast.success("✅ File uploaded");
            } else {
                toast.warn("QR code not found. Cannot proceed with upload.");
                return null;
            }
        } catch (error) {
            console.error("Error in file processing:", error);
            toast.error("Failed to process file.");
            return null;
        }
    };

    const uploadToPinata = async (file) => {
        if (!exfile) {
            toast.error("No extracted file data found.");
            return null;
        }

        if (landData.location.trim().toLowerCase() === exfile.property_details.location.trim().toLowerCase()) {
            toast.success("✅ Location matches! Proceeding with upload...");

            const pinataForm = new FormData();
            pinataForm.append("file", file);
            pinataForm.append("pinataMetadata", JSON.stringify({ name: file.name }));

            const config = {
                headers: {
                    "Content-Type": "multipart/form-data",
                    pinata_api_key: API_KEY,
                    pinata_secret_api_key: SECRET_KEY,
                },
            };

            const pinataResponse = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", pinataForm, config);
            return pinataResponse.data.IpfsHash;
        } else {
            toast.error("❌ Location does not match! Aborting file upload.");
            return null;
        }
    };

    const registerLand = async () => {
        if (!landData.location || !landData.price || !landData.document) {
            toast.error("Please enter location, price, and upload a document.");
            return;
        }
    
        const selectedNftTokens = showInput ? parseInt(landData.nftTokens) || 0 : 0;
        setNftTokens(selectedNftTokens);
    
        // Validate NFT tokens
        if (showInput && (isNaN(selectedNftTokens) || selectedNftTokens <= 0)) {
            toast.error("Invalid number of NFT tokens.");
            return;
        }
    
        try {
            const registrationFee = await contract.methods.registrationFee().call();
            const ipfsHash = await uploadToPinata(landData.document);
    
            if (!ipfsHash) {
                toast.error("Failed to upload document to Pinata. Registration aborted.");
                return;
            }
    
            // Calculate pricePerToken
            const priceInWei = web3.utils.toWei(landData.price, "ether");
            const pricePerToken = selectedNftTokens > 0 
                ? web3.utils.toWei((parseFloat(landData.price) / selectedNftTokens).toString(), "ether")
                : "0";
    
            console.log("Registering land with:", {
                location: landData.location,
                price: priceInWei,
                pricePerToken,
                ipfsHash,
                selectedNftTokens
            });
    
            await contract.methods.registerLand(
                landData.location,
                priceInWei,
                pricePerToken,
                ipfsHash,
                selectedNftTokens
            ).send({
                from: account,
                value: registrationFee,
            });
    
            toast.success("🎉 Land registered successfully!");
            fetchLands(contract);
        } catch (error) {
            console.error("Error in registerLand:", error);
            toast.error(`Failed to register land. Error: ${error.message}`);
        }
    };  
      
    const buyLand = async (landId, tokensToBuy, pricePerToken, landPrice) => {
        if (!contract || !account) {
            toast.error("Smart contract not loaded or account not connected.");
            return;
        }
    
        try {
            let value;
            if (tokensToBuy > 0) {
                // Buying NFTs: Calculate total price in Ether, then convert to Wei
                const totalPriceEther = tokensToBuy * parseFloat(pricePerToken);
                value = totalPriceEther.toString();
            } else {
                // Buying land without NFTs: Convert land price to Wei
                value = web3.utils.toWei(landPrice.toString(), "ether");
            }
    
            // Call the buyLand function in the smart contract
            await contract.methods.buyLand(landId, tokensToBuy).send({
                from: account,
                value: value, // Value is in Wei
            });
    
            // Show success message
            if (tokensToBuy > 0) {
                toast.success(`${tokensToBuy} NFT tokens purchased successfully!`);
            } else {
                toast.success("Land purchased successfully!");
            }
    
            // Refresh the land list
            fetchLands(contract);
        } catch (error) {
            console.error("Error during purchase:", error);
            toast.error("Failed to complete the purchase.");
        }
    };        
    const handleCheckboxChange = () => {
        setShowInput(!showInput);

        if (!showInput && exfile && exfile.property_details?.land_area) {
            const extractedArea = parseInt(exfile.property_details.land_area);
            if (!isNaN(extractedArea)) {
                setMaxTokens(extractedArea);
            }
        }
    };

    const displayValueInEther = (valueInWei) => {
        return web3.utils.fromWei(valueInWei.toString(), "ether");
    };

    const filteredLands = lands.filter((land) => {
        if (filterOption === "nft") return land.tokenCount > 0; // Lands with NFTs
        if (filterOption === "forsale") return land.isAvailable; // Lands that are still for sale
        if (filterOption === "sold") return !land.isAvailable; // Lands that have been sold
        return true; // Default: show all lands
    });
    
    return (
        <div>
            <h1>Land Registry DApp</h1>
            <p>Connected Account: {account || "Not connected"}</p>
    
            <h2>Register Land</h2>
            <input
                type="text"
                placeholder="Location"
                onChange={(e) => setLandData({ ...landData, location: e.target.value })}
            />
            <input
                type="text"
                placeholder="Price (ETH)"
                onChange={(e) => setLandData({ ...landData, price: e.target.value })}
            />
            <input type="file" accept="application/pdf" onChange={handleFileUpload} />
    
            <div>
                <input
                    type="checkbox"
                    id="toggleInput"
                    checked={showInput}
                    onChange={handleCheckboxChange}
                />
                <label htmlFor="toggleInput"> Create NFT</label>
            </div>
    
            {showInput && (
                <input
                    type="number"
                    placeholder={maxTokens ? `${maxTokens}` : "Enter token count"}
                    min="1"
                    max={maxTokens || ""}
                    onChange={(e) => setLandData({ ...landData, nftTokens: e.target.value })}
                />
            )}
    
            <button onClick={registerLand}>Register Land</button>
    
            <h2>Registered Lands</h2>
    
            {/* Dropdown for Filtering */}
            <select onChange={(e) => setFilterOption(e.target.value)}>
                <option value="all">All Lands</option>
                <option value="nft">NFT Lands</option>
                <option value="forsale">For Sale</option>
                <option value="sold">Sold Lands</option>
            </select>
    
            {/* Filtered Lands */}
            {filteredLands.length > 0 ? (
                filteredLands.map((land) => (
                    <div key={land.id} style={{ border: "1px solid black", padding: "10px", margin: "10px" }}>
                        <p><strong>ID:</strong> {land.id}</p>
                        <p><strong>Owner:</strong> {land.owner}</p>
                        <p><strong>Location:</strong> {land.location}</p>
                        <p><strong>Price:</strong> {ethers.formatEther(land.price)} ETH</p>
                        <p><strong>Price Per Token:</strong> {ethers.formatEther(land.pricePerToken)} ETH</p>
                        <p><strong>Status:</strong> {land.isAvailable ? "For sale" : "Sold"}</p>
                        <p><strong>Token Count:</strong> {land.tokenCount}</p>
                        <p>
                            <strong>Document:</strong>
                            <a href={`https://gateway.pinata.cloud/ipfs/${land.cid}`} target="_blank" rel="noopener noreferrer">
                                View Document
                            </a>
                        </p>
                        {land.isAvailable && land.owner !== account && (
                            <div>
                                <p>Price: {displayValueInEther(land.price)} ETH</p>
                                {land.tokenCount > 0 ? (
                                    <>
                                        <p>Price per Token: {displayValueInEther(land.pricePerToken)} ETH</p>
                                        <input
                                            type="number"
                                            placeholder="Enter tokens to buy"
                                            min="1"
                                            max={land.tokenCount}
                                            onChange={(e) => setNftTokens(parseInt(e.target.value))}
                                        />
                                        <button 
                                            onClick={() => buyLand(land.id, nftTokens, land.pricePerToken, 0)}
                                        >
                                            Buy NFT Tokens
                                        </button>
                                    </>
                                ) : (
                                    <button 
                                        onClick={() => buyLand(land.id, 0, 0, land.price)}
                                    >
                                        Buy Land
                                    </button>
                                )}
                            </div>
                        )}                      
                    </div>
                ))
            ) : (
                <p>No lands found matching the filter.</p>
            )}
            <ToastContainer />
        </div>
    );
        
};
export default Landregs;