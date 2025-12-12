/**
 * Debug script for testing resolveAirline function
 * Run with: npx ts-node debug-airline.ts
 */

import { resolveAirline, AIRLINES_BY_CODE } from "./src/constants/airlines";
import * as readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const testCases = [
  "UA",
  "KL",
  "KLM",
  "Southwest",
  "WN",
  "United Airlines",
  "United",
  "AF",
  "Air France",
  "Delta",
  "DL",
  "QR",
  "Qatar Airways",
];

console.log("=== Airline Resolver Debugger ===\n");
console.log("Available airlines:");
Object.values(AIRLINES_BY_CODE).forEach((airline) => {
  console.log(`  ${airline.code}: ${airline.name}`);
});
console.log("\n");

const promptUser = (): void => {
  rl.question('Enter airline input (or "test" to run test cases, "exit" to quit): ', (input) => {
    if (input.toLowerCase() === "exit") {
      rl.close();
      return;
    }

    if (input.toLowerCase() === "test") {
      console.log("\n--- Running Test Cases ---");
      testCases.forEach((testInput) => {
        const result = resolveAirline(testInput);
        console.log(
          `Input: "${testInput}" => ${
            result ? `${result.code}: ${result.name}` : "null"
          }`
        );
      });
      console.log("--- End Test Cases ---\n");
      promptUser();
      return;
    }

    const result = resolveAirline(input);
    console.log(
      `Result: ${
        result ? `${result.code}: ${result.name}` : "No match found"
      }\n`
    );
    promptUser();
  });
};

promptUser();
