import "dotenv/config";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const source=process.argv[2];
if(!source)throw new Error("Usage: npm run db:restore -- backups\\quotation.backup");
if(!existsSync(path.resolve(source)))throw new Error(`Backup not found: ${source}`);
if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is missing");
const url=new URL(process.env.DATABASE_URL);url.searchParams.delete("schema");
const result=spawnSync("pg_restore",["--clean","--if-exists","--no-owner","--dbname",url.toString(),path.resolve(source)],{stdio:"inherit"});
if(result.error?.code==="ENOENT")throw new Error("pg_restore was not found. Add the PostgreSQL bin folder to PATH.");
if(result.status!==0)process.exit(result.status||1);
console.log("Database restore completed successfully.");
