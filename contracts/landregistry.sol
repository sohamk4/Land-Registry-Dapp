// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LandRegistry is ERC721URIStorage, Ownable {
    uint256 public registrationFee = 0.01 ether;
    uint256 public landCount = 0;
    uint256 public tokenIdCounter = 1;

    struct Land {
        address owner;
        string location;
        uint256 price; // Total price for whole land (if no NFTs)
        uint256 pricePerToken; // Price per NFT token (if NFTs exist)
        bool isAvailable;
        string cid; // IPFS CID for document
        uint256 tokenCount; // NFT tokens count (0 means no NFT)
        uint256[] tokenIds; // NFT token IDs
    }

    mapping(uint256 => Land) public lands;

    event LandRegistered(uint256 landId, address owner, string location, uint256 price, string cid, uint256 tokenCount);
    event LandTokenBought(uint256 landId, address newOwner, uint256 tokenId, uint256 price);
    event LandBought(uint256 landId, address newOwner, uint256 price);
    event NFTMinted(uint256 indexed tokenId, uint256 indexed landId, address owner, string tokenURI);

    constructor() ERC721("LandNFT", "LND") Ownable() {}

    function registerLand(
        string memory _location,
        uint256 _price,
        uint256 _pricePerToken,
        string memory _cid,
        uint256 _tokenCount
    ) public payable {
        require(msg.value == registrationFee, "Incorrect registration fee amount");

        // Emit the LandRegistered event
        emit LandRegistered(landCount, msg.sender, _location, _price, _cid, _tokenCount);

        // Initialize an array to store token IDs (if NFTs are being minted)
        uint256[] memory tokenIds = new uint256[](_tokenCount);

        // If _tokenCount > 0, mint NFTs
        if (_tokenCount > 0) {
            require(_pricePerToken > 0, "NFT price must be set");

            for (uint256 i = 0; i < _tokenCount; i++) {
                uint256 newTokenId = tokenIdCounter++;
                _mint(msg.sender, newTokenId); // Mint the NFT
                _setTokenURI(newTokenId, _cid); // Set the token URI
                tokenIds[i] = newTokenId; // Store the token ID
                emit NFTMinted(newTokenId, landCount, msg.sender, _cid); // Emit NFTMinted event
            }
        }

        // Increment landCount and store land details
        landCount++;
        bool availability = _tokenCount > 0 ? true : (_price > 0); // Set availability
        lands[landCount] = Land(
            msg.sender, // Owner
            _location, // Location
            _price, // Price
            _pricePerToken, // Price per token
            availability, // Availability
            _cid, // CID
            _tokenCount, // Token count
            tokenIds // Token IDs
        );
    }

    function buyLand(uint256 _landId, uint256 _tokensToBuy) public payable {
        require(_landId > 0 && _landId <= landCount, "Invalid land ID");

        Land storage land = lands[_landId];
        require(land.isAvailable, "Land is not available for sale");

        address previousOwner = land.owner;

        if (land.tokenCount > 0) {
            // Buying NFTs from land registered with NFTs
            require(_tokensToBuy > 0 && _tokensToBuy <= land.tokenCount, "Invalid token amount");

            uint256 totalPrice = _tokensToBuy * land.pricePerToken;
            require(msg.value == totalPrice, "Incorrect ETH amount sent");

            uint256 tokensTransferred = 0;

            // Transfer NFT tokens
            for (uint256 i = 0; i < land.tokenIds.length && tokensTransferred < _tokensToBuy; i++) {
                uint256 tokenId = land.tokenIds[i];

                if (ownerOf(tokenId) == previousOwner) {
                    _transfer(previousOwner, msg.sender, tokenId);
                    tokensTransferred++;

                    emit LandTokenBought(_landId, msg.sender, tokenId, land.pricePerToken);
                }
            }

            require(tokensTransferred == _tokensToBuy, "Not enough available tokens");

            // Update remaining token count
            land.tokenCount -= _tokensToBuy;
            if (land.tokenCount == 0) {
                land.isAvailable = false; // Mark land as unavailable if all tokens are sold
            }
        } else {
            // Buying land without NFTs
            require(_tokensToBuy == 0, "This land does not have NFTs");
            require(msg.value == land.price, "Incorrect ETH amount sent");

            // Transfer ownership
            land.owner = msg.sender;
            land.isAvailable = false;

            emit LandBought(_landId, msg.sender, land.price);
        }

        // Transfer payment to seller
        (bool success, ) = payable(previousOwner).call{value: msg.value}("");
        require(success, "Transfer to seller failed");
    }

    function getLand(uint256 _landId) public view returns (address, string memory, uint256, uint256, bool, string memory, uint256, uint256[] memory) {
        require(_landId > 0 && _landId <= landCount, "Invalid land ID");
        Land memory land = lands[_landId];
        return (land.owner, land.location, land.price, land.pricePerToken, land.isAvailable, land.cid, land.tokenCount, land.tokenIds);
    }

    function setRegistrationFee(uint256 _newFee) public onlyOwner {
        registrationFee = _newFee;
    }

    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");

        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdraw failed");
    }
}