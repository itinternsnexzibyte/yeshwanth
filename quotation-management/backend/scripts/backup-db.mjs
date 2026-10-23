import "dotenv/config";
import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is missing");
const url=new URL(process.env.DATABASE_URL);url.searchParams.delete("schema");
const directory=path.resolve("backups");mkdirSync(directory,{recursive:true});
const destination=path.resolve(process.argv[2]||path.join("backups",`quotation-${new Date().toISOString().replaceAll(":","-")}.backup`));
const result=spawnSync("pg_dump",["--format=custom","--no-owner","--file",destination,url.toString()],{stdio:"inherit"});
if(result.error?.code==="ENOENT")throw new Error("pg_dump was not found. Add the PostgreSQL bin folder to PATH.");
if(result.status!==0)process.exit(result.status||1);
console.log(`Database backup created: ${destination}`);
