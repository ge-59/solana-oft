const { addressToBytes32 } = require('@layerzerolabs/lz-v2-utilities')

// The Solana address to convert
const solanaAddress = 'HRa9tXLR5rvqhvBGqAL2qLqDdTMb7ZeGYCQ9erjdRaUz'

// Convert to bytes32
const bytes32Array = addressToBytes32(solanaAddress)

// Convert to hex string
const bytes32Hex = '0x' + Buffer.from(bytes32Array).toString('hex')

console.log('\nSolana address:', solanaAddress)
console.log('Bytes32 format (hex):', bytes32Hex)