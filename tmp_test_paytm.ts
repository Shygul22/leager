import PaytmChecksumModule from "npm:paytmchecksum"
const PaytmChecksum = (PaytmChecksumModule as any).default || PaytmChecksumModule

const paytmParams = {
  "MID": "YOUR_MID_HERE",
  "WEBSITE": "WEBSTAGING",
  "INDUSTRY_TYPE_ID": "Retail",
  "CHANNEL_ID": "WEB",
  "ORDER_ID": "TEST_ORDER_123",
  "CUST_ID": "TEST_CUST_123",
  "TXN_AMOUNT": "1.00",
  "CALLBACK_URL": "https://callback.url",
}

const merchantKey = "YOUR_MERCHANT_KEY_HERE"

try {
  console.log("Generating Checksum...")
  const checksum = await PaytmChecksum.generateSignature(paytmParams, merchantKey)
  console.log("Checksum Generated:", checksum)
  
  console.log("Verifying Checksum...")
  const isVerifySignature = await PaytmChecksum.verifySignature(paytmParams, merchantKey, checksum)
  console.log("Is Signature Valid:", isVerifySignature)
} catch (error) {
  console.error("Error:", error)
}
