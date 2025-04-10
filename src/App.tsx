import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import HeroNFTArtifact from "./abi/HeroNFT.json";
import "./App.css";

const CONTRACT_ADDRESS = "0x2B6fF46A23AE69F42ea738AE80101874996DF487";
const HeroNFTABI = HeroNFTArtifact.abi;

interface NFT {
  tokenId: number;
  owner: string;
  price: string;
  rarity: string;
  strength: number;
  agility: number;
  intelligence: number;
}

const App: React.FC = () => {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [account, setAccount] = useState<string>("");
  const [myNFTs, setMyNFTs] = useState<NFT[]>([]);
  const [allNFTs, setAllNFTs] = useState<NFT[]>([]);
  const [listTokenId, setListTokenId] = useState<number>(0);
  const [listPrice, setListPrice] = useState<string>("");
  const [delistTokenId, setDelistTokenId] = useState<number>(0);
  const [offerTokenId, setOfferTokenId] = useState<number>(0);
  const [offerPrice, setOfferPrice] = useState<string>("");
  const [acceptTokenId, setAcceptTokenId] = useState<number>(0);
  const [acceptBuyer, setAcceptBuyer] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<string>("home");
  const [mintPrice, setMintPrice] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [isMyNFTsListed, setIsMyNFTsListed] = useState<boolean>(false);
  const [isAllNFTsListed, setIsAllNFTsListed] = useState<boolean>(false);
  const [fetchProgress, setFetchProgress] = useState<string>("");

  useEffect(() => {
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    if (!window.ethereum) {
      setMessage("Please install MetaMask!");
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_accounts", []);

      if (accounts.length > 0) {
        await initializeApp(provider, accounts[0]);
      }
    } catch (error: any) {
      setMessage(`Error checking wallet: ${error.message}`);
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      setMessage("Please install MetaMask!");
      return;
    }

    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);

      if (accounts.length === 0) {
        setMessage("No accounts found. Please unlock MetaMask.");
        return;
      }

      await initializeApp(provider, accounts[0]);

      window.ethereum.on("accountsChanged", (newAccounts: string[]) => {
        if (newAccounts.length > 0) {
          initializeApp(provider, newAccounts[0]);
        } else {
          disconnectWallet();
        }
      });

      window.ethereum.on("chainChanged", (chainId: string) => {
        if (chainId !== "0xaa36a7") {
          setMessage("Please switch to Sepolia network.");
          disconnectWallet();
        } else {
          checkWalletConnection();
        }
      });
    } catch (error: any) {
      setMessage(`Connection failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const initializeApp = async (provider: ethers.BrowserProvider, account: string) => {
    const network = await provider.getNetwork();
    if (network.chainId !== BigInt(11155111)) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0xaa36a7" }],
        });
      } catch (switchError: any) {
        setMessage(`Failed to switch to Sepolia: ${switchError.message}`);
        return;
      }
    }

    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, HeroNFTABI, signer);

    setProvider(provider);
    setSigner(signer);
    setContract(contract);
    setAccount(account);
    setMessage(`Connected: ${account.slice(0, 6)}...${account.slice(-4)}`);
    await fetchMintPrice(contract);
  };

  const disconnectWallet = () => {
    setProvider(null);
    setSigner(null);
    setContract(null);
    setAccount("");
    setMyNFTs([]);
    setAllNFTs([]);
    setIsMyNFTsListed(false);
    setIsAllNFTsListed(false);
    setMessage("Disconnected");
    setFetchProgress("");
  };

  const fetchMintPrice = async (contractInstance: ethers.Contract) => {
    try {
      const price = await contractInstance.MINT_PRICE();
      setMintPrice(ethers.formatEther(price));
    } catch (error: any) {
      setMessage(`Failed to fetch mint price: ${error.message}`);
    }
  };

  const fetchMyNFTs = async () => {
    if (!contract || !account) return;
    try {
      setLoading(true);
      setFetchProgress("Fetching your NFTs... (Checking up to 50 tokens)");
      const nfts: NFT[] = [];
      const balance = Number(await contract.balanceOf(account));
      const MAX_TOKENS_TO_CHECK = 50; // Giảm xuống 50 để tăng tốc

      for (let tokenId = 0; tokenId < MAX_TOKENS_TO_CHECK && nfts.length < balance; tokenId++) {
        try {
          const owner = await contract.ownerOf(tokenId);
          if (owner.toLowerCase() === account.toLowerCase()) {
            const hero = await contract.heroes(tokenId);
            const listedPrice = await contract.listedNFTs(tokenId);
            nfts.push({
              tokenId,
              owner,
              price: ethers.formatEther(listedPrice),
              rarity: ["Common", "Rare", "Legendary", "Mythical"][Number(hero.rarity)],
              strength: Number(hero.strength),
              agility: Number(hero.agility),
              intelligence: Number(hero.intelligence),
            });
            setFetchProgress(`Found ${nfts.length}/${balance} NFTs...`);
          }
        } catch {
          continue;
        }
      }
      setMyNFTs(nfts);
      setIsMyNFTsListed(true);
      setFetchProgress("");
      if (nfts.length === 0) setMessage("No NFTs found for this account.");
      else setMessage(`Found ${nfts.length} NFTs (checked ${MAX_TOKENS_TO_CHECK} tokens).`);
    } catch (error: any) {
      setMessage(`Failed to fetch your NFTs: ${error.message}`);
      setFetchProgress("");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllNFTs = async () => {
    if (!contract) return;
    try {
      setLoading(true);
      setFetchProgress("Fetching all listed NFTs... (Checking up to 50 tokens)");
      const nfts: NFT[] = [];
      const MAX_TOKENS_TO_CHECK = 50; // Giảm xuống 50 để tăng tốc

      for (let tokenId = 0; tokenId < MAX_TOKENS_TO_CHECK; tokenId++) {
        try {
          const listingPrice = await contract.listedNFTs(tokenId);
          if (listingPrice > 0) {
            const owner = await contract.ownerOf(tokenId);
            const hero = await contract.heroes(tokenId);
            nfts.push({
              tokenId,
              owner,
              price: ethers.formatEther(listingPrice),
              rarity: ["Common", "Rare", "Legendary", "Mythical"][Number(hero.rarity)],
              strength: Number(hero.strength),
              agility: Number(hero.agility),
              intelligence: Number(hero.intelligence),
            });
            setFetchProgress(`Found ${nfts.length} listed NFTs...`);
          }
        } catch {
          continue;
        }
      }
      setAllNFTs(nfts);
      setIsAllNFTsListed(true);
      setFetchProgress("");
      if (nfts.length === 0) setMessage("No listed NFTs found.");
      else setMessage(`Found ${nfts.length} listed NFTs (checked ${MAX_TOKENS_TO_CHECK} tokens).`);
    } catch (error: any) {
      setMessage(`Failed to fetch all NFTs: ${error.message}`);
      setFetchProgress("");
    } finally {
      setLoading(false);
    }
  };

  const mintNFT = async () => {
    if (!contract || !signer) return;
    try {
      setLoading(true);
      const mintPriceWei = await contract.MINT_PRICE();
      const tx = await contract.mintHero({ value: mintPriceWei });
      setMessage("Minting NFT...");
      const receipt = await tx.wait();
      setMessage(`NFT minted! Tx: ${receipt.hash}`);
      if (isMyNFTsListed) await fetchMyNFTs();
    } catch (error: any) {
      setMessage(`Mint failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const listNFT = async (tokenId: number, price: string) => {
    if (!contract || !price) return;
    try {
      setLoading(true);
      const tx = await contract.listNFT(tokenId, ethers.parseEther(price));
      await tx.wait();
      setMessage(`NFT #${tokenId} listed`);
      if (isMyNFTsListed) await fetchMyNFTs();
      if (isAllNFTsListed) await fetchAllNFTs();
    } catch (error: any) {
      setMessage(`List failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const delistNFT = async (tokenId: number) => {
    if (!contract) return;
    try {
      setLoading(true);
      const tx = await contract.delistNFT(tokenId);
      await tx.wait();
      setMessage(`NFT #${tokenId} delisted`);
      if (isMyNFTsListed) await fetchMyNFTs();
      if (isAllNFTsListed) await fetchAllNFTs();
    } catch (error: any) {
      setMessage(`Delist failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const offerNFT = async (tokenId: number, price: string) => {
    if (!contract || !price) return;
    try {
      setLoading(true);
      const tx = await contract.offerNFT(tokenId, {
        value: ethers.parseEther(price),
      });
      await tx.wait();
      setMessage(`Offered ${price} ETH for NFT #${tokenId}`);
    } catch (error: any) {
      setMessage(`Offer failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const acceptOffer = async (tokenId: number, buyer: string) => {
    if (!contract || !buyer) return;
    try {
      setLoading(true);
      const tx = await contract.acceptOffer(tokenId, buyer);
      await tx.wait();
      setMessage(`Offer accepted for NFT #${tokenId}`);
      if (isMyNFTsListed) await fetchMyNFTs();
      if (isAllNFTsListed) await fetchAllNFTs();
    } catch (error: any) {
      setMessage(`Accept failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderNFTItem = (nft: NFT, isMyNFT: boolean) => {
    const isListed = Number(nft.price) > 0;

    return (
      <div className="nft-item" key={nft.tokenId}>
        <h3>NFT #{nft.tokenId}</h3>
        <p>Owner: {nft.owner.slice(0, 6)}...{nft.owner.slice(-4)}</p>
        <p>Price: {nft.price} ETH</p>
        <p>Rarity: {nft.rarity}</p>
        <p>Strength: {nft.strength}</p>
        <p>Agility: {nft.agility}</p>
        <p>Intelligence: {nft.intelligence}</p>

        {isMyNFT ? (
          isListed ? (
            <div className="nft-actions">
              <button
                className="action-btn"
                onClick={() => delistNFT(nft.tokenId)}
                disabled={loading}
              >
                {loading ? "Processing..." : "Delist"}
              </button>
              <input
                type="text"
                placeholder="Buyer Address"
                onChange={(e) => setAcceptBuyer(e.target.value)}
                className="input-field wide-input"
              />
              <button
                className="action-btn"
                onClick={() => acceptOffer(nft.tokenId, acceptBuyer)}
                disabled={loading || !acceptBuyer}
              >
                {loading ? "Processing..." : "Accept Offer"}
              </button>
            </div>
          ) : (
            <div className="nft-actions">
              <input
                type="text"
                placeholder="Price (ETH)"
                onChange={(e) => setListPrice(e.target.value)}
                className="input-field"
              />
              <button
                className="action-btn"
                onClick={() => listNFT(nft.tokenId, listPrice)}
                disabled={loading || !listPrice}
              >
                {loading ? "Processing..." : "List"}
              </button>
            </div>
          )
        ) : (
          <div className="nft-actions">
            <input
              type="text"
              placeholder="Offer Price (ETH)"
              onChange={(e) => setOfferPrice(e.target.value)}
              className="input-field"
            />
            <button
              className="action-btn"
              onClick={() => offerNFT(nft.tokenId, offerPrice)}
              disabled={loading || !offerPrice}
            >
              {loading ? "Processing..." : "Offer"}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-container">
      <nav className="navbar">
        <span className="logo">HeroNFT</span>
        <ul className="nav-menu">
          <li>
            <button onClick={() => setCurrentPage("home")}>Home</button>
          </li>
          <li>
            <button onClick={() => setCurrentPage("mint")}>Mint</button>
          </li>
          <li>
            <button onClick={() => setCurrentPage("marketplace")}>Marketplace</button>
          </li>
          <li>
            <button onClick={() => setCurrentPage("my-nfts")}>My NFTs</button>
          </li>
        </ul>
        <div className="wallet-controls">
          {account ? (
            <>
              <span>{account.slice(0, 6)}...{account.slice(-4)}</span>
              <button className="disconnect-btn" onClick={disconnectWallet}>
                Disconnect
              </button>
            </>
          ) : (
            <button className="connect-btn" onClick={connectWallet} disabled={loading}>
              {loading ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
        </div>
      </nav>

      <div className="content">
        {currentPage === "home" && (
          <section>
            <h2>All Listed NFTs</h2>
            <button
              className="action-btn"
              onClick={fetchAllNFTs}
              disabled={loading || !account}
            >
              {loading ? "Loading..." : "List All NFTs"}
            </button>
            {fetchProgress && <p className="info-msg">{fetchProgress}</p>}
            {isAllNFTsListed && (
              loading ? (
                <p>Loading...</p>
              ) : allNFTs.length > 0 ? (
                <div className="nft-grid">{allNFTs.map((nft) => renderNFTItem(nft, false))}</div>
              ) : (
                <p>No NFTs listed yet.</p>
              )
            )}
          </section>
        )}

        {currentPage === "mint" && account && (
          <section>
            <h2>Mint NFT</h2>
            <p>Mint Price: {mintPrice} ETH</p>
            <button className="action-btn" onClick={mintNFT} disabled={loading}>
              {loading ? "Minting..." : "Mint"}
            </button>
          </section>
        )}

        {currentPage === "marketplace" && account && (
          <section>
            <h2>Marketplace Actions</h2>
            <div className="action-section">
              <h3>List NFT</h3>
              <input
                type="number"
                placeholder="Token ID"
                value={listTokenId}
                onChange={(e) => setListTokenId(Number(e.target.value))}
                className="input-field"
              />
              <input
                type="text"
                placeholder="Price (ETH)"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                className="input-field"
              />
              <button className="action-btn" onClick={() => listNFT(listTokenId, listPrice)} disabled={loading}>
                {loading ? "Listing..." : "List"}
              </button>
            </div>
            <div className="action-section">
              <h3>Delist NFT</h3>
              <input
                type="number"
                placeholder="Token ID"
                value={delistTokenId}
                onChange={(e) => setDelistTokenId(Number(e.target.value))}
                className="input-field"
              />
              <button className="action-btn" onClick={() => delistNFT(delistTokenId)} disabled={loading}>
                {loading ? "Delisting..." : "Delist"}
              </button>
            </div>
            <div className="action-section">
              <h3>Offer NFT</h3>
              <input
                type="number"
                placeholder="Token ID"
                value={offerTokenId}
                onChange={(e) => setOfferTokenId(Number(e.target.value))}
                className="input-field"
              />
              <input
                type="text"
                placeholder="Offer Price (ETH)"
                value={offerPrice}
                onChange={(e) => setOfferPrice(e.target.value)}
                className="input-field"
              />
              <button className="action-btn" onClick={() => offerNFT(offerTokenId, offerPrice)} disabled={loading}>
                {loading ? "Offering..." : "Offer"}
              </button>
            </div>
            <div className="action-section">
              <h3>Accept Offer</h3>
              <input
                type="number"
                placeholder="Token ID"
                value={acceptTokenId}
                onChange={(e) => setAcceptTokenId(Number(e.target.value))}
                className="input-field"
              />
              <input
                type="text"
                placeholder="Buyer Address"
                value={acceptBuyer}
                onChange={(e) => setAcceptBuyer(e.target.value)}
                className="input-field wide-input"
              />
              <button className="action-btn" onClick={() => acceptOffer(acceptTokenId, acceptBuyer)} disabled={loading}>
                {loading ? "Accepting..." : "Accept"}
              </button>
            </div>
          </section>
        )}

        {currentPage === "my-nfts" && account && (
          <section>
            <h2>My NFTs</h2>
            <button
              className="action-btn"
              onClick={fetchMyNFTs}
              disabled={loading}
            >
              {loading ? "Loading..." : "List My NFTs"}
            </button>
            {fetchProgress && <p className="info-msg">{fetchProgress}</p>}
            {isMyNFTsListed && (
              loading ? (
                <p>Loading...</p>
              ) : myNFTs.length > 0 ? (
                <div className="nft-grid">{myNFTs.map((nft) => renderNFTItem(nft, true))}</div>
              ) : (
                <p>You don’t own any NFTs yet.</p>
              )
            )}
          </section>
        )}

        {!account && <p className="info-msg">Please connect your wallet to proceed.</p>}
      </div>

      {message && (
        <p className={message.includes("failed") ? "error-msg" : "success-msg"}>{message}</p>
      )}
    </div>
  );
};
//ngxuha
export default App;