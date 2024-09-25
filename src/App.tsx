// App.tsx
import React, { useEffect, useState } from "react";
import { createPublicClient, http, parseAbi } from "viem";
import { defineChain } from "viem";

const BRIDGE_ADDRESS = "0x3100000000000000000000000000000000000002";
const MEMPOOL_SPACE_URL = "https://mempool.space/testnet4/";

// define deposit log type
interface DepositLog {
  wtxId?: `0x${string}` | undefined;
  txId?: `0x${string}` | undefined;
  recipient?: `0x${string}` | undefined;
  timestamp?: bigint | undefined;
  depositId?: bigint | undefined;
}

interface WithdrawalLog {
  utxo?: readonly [`0x${string}`, `0x${string}`] | undefined;
  index?: bigint | undefined;
  timestamp?: bigint | undefined;
}

interface WithdrawFillerLog {
  withdrawId?: bigint | undefined;
  withdrawFillerId?: bigint | undefined;
}

const reverseHex = (hexString: string): string => {
  // Remove the '0x' prefix if it exists
  const cleanedHex = hexString.startsWith("0x")
    ? hexString.slice(2)
    : hexString;

  // Split the string into pairs of characters, reverse, and join
  const reversedHex =
    cleanedHex
      .match(/.{1,2}/g)
      ?.reverse()
      .join("") || "";

  return reversedHex;
};

const App: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [citreaRpc, setCitreaRpc] = useState("https://rpc.testnet.citrea.xyz/");
  const [bitcoinApi, setBitcoinApi] = useState(
    "https://mempool.space/testnet4/api/"
  );
  const [operatorKeys, setOperatorKeys] = useState("");
  const [progress, setProgress] = useState(0);
  const [depositLogs, setDepositLogs] = useState<DepositLog[]>([]);
  const [withdrawLogs, setWithdrawLogs] = useState<WithdrawalLog[]>([]);
  const [withdrawFillerLogs, setWithdrawFillerLogs] = useState<
    Record<number, number>
  >({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Function to fetch resources and update progress
  const fetchResources = async () => {
    setIsLoaded(false);

    try {
      const citrea = defineChain({
        id: 5115,
        name: "Citrea Testnet",
        nativeCurrency: {
          decimals: 18,
          name: "Citrea BTC",
          symbol: "cBTC",
        },
        rpcUrls: {
          default: {
            http: [citreaRpc],
          },
        },
        blockExplorers: {
          default: {
            name: "Citrea Testnet Explorer",
            url: "https://explorer.testnet.citrea.xyz",
          },
        },
      });

      const client = createPublicClient({
        chain: citrea,
        transport: http(),
      });

      const blockNumber = await client.getBlockNumber();
      const batchSize = BigInt(1000); // Batch size of 1000 blocks

      let fromBlock = BigInt(0);

      while (fromBlock <= blockNumber) {
        let toBlock = fromBlock + batchSize - BigInt(1);

        // Ensure that we don't go beyond the latest block
        if (toBlock > blockNumber) {
          toBlock = blockNumber;
        }

        try {
          const logs = await client.getLogs({
            address: BRIDGE_ADDRESS,
            events: parseAbi([
              "event Deposit(bytes32 wtxId, bytes32 txId, address recipient, uint256 timestamp, uint256 depositId)",
              "event Withdrawal((bytes32, bytes4) utxo, uint256 index, uint256 timestamp)",
              "event WithdrawFillerDeclared(uint256 withdrawId, uint256 withdrawFillerId)",
            ]),
            fromBlock,
            toBlock,
          });

          console.log(`Logs from block ${fromBlock} to ${toBlock}:`, logs);
          // loop through logs and update state
          logs.forEach((log) => {
            if (log.eventName === "Deposit") {
              // Update deposit logs
              setDepositLogs((prevLogs) => [...prevLogs, log.args]);
            } else if (log.eventName === "Withdrawal") {
              setWithdrawLogs((prevLogs) => [...prevLogs, log.args]);
            } else if (log.eventName === "WithdrawFillerDeclared") {
              setWithdrawFillerLogs((prevLogs) => ({
                ...prevLogs,
                [Number(log.args.withdrawId)]: Number(
                  log.args.withdrawFillerId
                ),
              }));
            }
          });
        } catch (error) {
          console.error(
            `Error fetching logs from block ${fromBlock} to ${toBlock}:`,
            error
          );
        }

        // Update the next `fromBlock` to be one after the current `toBlock`
        fromBlock = toBlock + BigInt(1);
        // update progress
        setProgress(Number((Number(fromBlock) / Number(blockNumber)) * 100));
      }
      setIsLoaded(true);
    } catch (error) {
      console.error("Error fetching resources:", error);
      setIsLoaded(false);
    }
  };

  // Fetch resources on page load
  useEffect(() => {
    fetchResources();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 w-full flex justify-between p-4 bg-blue-600 text-white shadow-md z-50">
        <h1 className="text-xl">Resource Fetcher</h1>
        <button
          className="px-4 py-2 bg-blue-700 rounded"
          onClick={() => setIsSettingsOpen(true)}
        >
          Settings
        </button>
      </header>

      {/* Add some margin to ensure content is visible under the fixed header */}
      <div className="w-full pt-20 flex flex-col items-center">
        {/* Progress Bar */}
        <div className="w-full max-w-xl bg-gray-300 rounded h-4 my-8 mx-auto">
          <div
            className="bg-blue-600 h-4 rounded"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Deposit Logs Table */}
      <div className="mx-auto p-4 bg-white rounded shadow-md">
        <h2 className="text-2xl font-semibold mb-4">
          Deposit, Withdrawal & Withdraw Filler Logs
        </h2>
        {depositLogs.length > 0 || withdrawLogs.length > 0 ? (
          <table className="min-w-full text-left table-auto border-collapse border border-gray-300">
            <thead>
              <tr>
                <th className="border border-gray-300 p-2">Deposit</th>
                <th className="border border-gray-300 p-2">
                  Withdrawal (utxo)
                </th>
                <th className="border border-gray-300 p-2">
                  WithdrawFiller (withdrawId)
                </th>
              </tr>
            </thead>
            <tbody>
              {depositLogs.map((deposit, index) => (
                <tr key={index}>
                  <td className="border border-gray-300 p-2">
                    <p>
                      <a
                        className="text-blue-500 hover:text-blue-700 underline focus:outline-none focus:ring focus:ring-blue-300 active:text-blue-800 transition ease-in-out duration-150"
                        target="_blank"
                        rel="noopener noreferrer"
                        href={`${MEMPOOL_SPACE_URL}tx/${reverseHex(
                          deposit.txId || ""
                        )}`}
                      >
                        {reverseHex(deposit.txId || "")}
                      </a>
                    </p>
                    <p>
                      <span className="font-semibold">recipient:</span>{" "}
                      {deposit.recipient}
                    </p>
                  </td>
                  <td className="border border-gray-300 p-2">
                    {withdrawLogs[index] ? (
                      <>
                        <a
                          className="text-blue-500 hover:text-blue-700 underline focus:outline-none focus:ring focus:ring-blue-300 active:text-blue-800 transition ease-in-out duration-150"
                          target="_blank"
                          rel="noopener noreferrer"
                          href={
                            withdrawLogs[index]?.utxo &&
                            withdrawLogs[index].utxo[0]
                              ? `${MEMPOOL_SPACE_URL}tx/${reverseHex(
                                  withdrawLogs[index].utxo[0]
                                )}`
                              : "#"
                          }
                        >
                          {withdrawLogs[index].utxo}
                        </a>{" "}
                        <p>
                          <span className="font-semibold">index:</span>{" "}
                          {withdrawLogs[index].index?.toString()}
                        </p>
                        <p>
                          <span className="font-semibold">timestamp:</span>{" "}
                          {withdrawLogs[index].timestamp?.toString()}
                        </p>
                      </>
                    ) : (
                      <p>No withdrawal log available</p>
                    )}
                  </td>
                  <td className="border border-gray-300 p-2">
                    {withdrawLogs[index] ? (
                      <>
                        <p>
                          <span className="font-semibold">withdrawId:</span>{" "}
                          {index}
                        </p>
                        <p>
                          <span className="font-semibold">
                            withdrawFillerId:
                          </span>{" "}
                          {withdrawFillerLogs[index]}
                        </p>
                      </>
                    ) : (
                      <p>No withdraw filler log available</p>
                    )}
                  </td>{" "}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No logs available yet.</p>
        )}
      </div>

      {/* Settings Popup */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded shadow-md max-w-lg w-full">
            <h2 className="text-lg font-semibold mb-4">Settings</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Citrea RPC
              </label>
              <input
                type="text"
                value={citreaRpc}
                onChange={(e) => setCitreaRpc(e.target.value)}
                className="mt-1 p-2 w-full border rounded"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Bitcoin API
              </label>
              <input
                type="text"
                value={bitcoinApi}
                onChange={(e) => setBitcoinApi(e.target.value)}
                className="mt-1 p-2 w-full border rounded"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Operator Public Keys
              </label>
              <textarea
                value={operatorKeys}
                onChange={(e) => setOperatorKeys(e.target.value)}
                className="mt-1 p-2 w-full border rounded"
              />
            </div>
            <div className="flex justify-end space-x-4">
              <button
                className="px-4 py-2 bg-gray-300 rounded"
                onClick={() => setIsSettingsOpen(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded"
                onClick={() => {
                  setIsSettingsOpen(false);
                  fetchResources(); // Call the fetch function when settings are saved
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
