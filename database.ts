import { Collection, MongoClient } from "mongodb";
import { Minifig, Set, IUser, IUserMinifigsCollection } from "./types/types";
import dotenv from "dotenv";
import bcrypt from 'bcrypt';

dotenv.config();

const apiKey: string = process.env.REBRICKABLE_API_KEY ?? "";
const rateLimitDelayMs = 3000; // Adjust this value based on the API's rate limits

async function fetchData(url: string) {
    try {
        const response = await fetch(`${url}?key=${apiKey}`);
        const data = await response.json();
        if (!data.results) {
            throw new Error('No results found in API response');
        }
        let results = data.results;

        // Check if there is a "next" URL in the response
        let nextUrl = data.next;
        let i: number = 0;
        while (nextUrl) {
            await new Promise(resolve => setTimeout(resolve, rateLimitDelayMs)); // rate limit
            console.log(i);
            i++;
            const nextPageResponse = await fetch(nextUrl); // fetches next page of api
            const nextPageData = await nextPageResponse.json();
            results = results.concat(nextPageData.results); // concat to previous api call results
            nextUrl = nextPageData.next; // update the new page number
        }
        console.log(results);
        return results;
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

// Account related code here
async function registerUser(email: string, username: string, password: string): Promise<string> {
    try {
        const userExists = await usersCollection.findOne({ username });
        if (userExists) {
            return 'User already exists';
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser: IUser = {
            email,
            username,
            password: hashedPassword,
        };

        await usersCollection.insertOne(newUser);
        return 'User registered successfully';
    } catch (error) {
        console.error('Error registering user:', error);
        return 'Server error';
    }
}

// All database related code comes here

const uri: string = process.env.MONGODB_URI ?? "mongodb://localhost:27017";
console.log(uri);
const client = new MongoClient(uri);
export const minifigsCollection: Collection<Minifig> = client.db("lego").collection<Minifig>("minifigs");
export const setsCollection: Collection<Set> = client.db("lego").collection<Set>("sets");
export const usersCollection: Collection<IUser> = client.db("lego").collection<IUser>("users");
export const userMinifigCollection: Collection<IUserMinifigsCollection> = client.db("lego").collection<IUserMinifigsCollection>("userMinifigCollection");
export const blacklistCollection: Collection<any> = client.db("lego").collection<any>("blacklist");

async function seed() {
    if (await minifigsCollection.countDocuments() === 0) {
        const minifigsData: any = await fetchData("https://rebrickable.com/api/v3/lego/minifigs/");
        const minifigs: Minifig[] = minifigsData;
        console.log('Minifigs data:', minifigs);
        await minifigsCollection.insertMany(minifigs);
    }

    if (await setsCollection.countDocuments() === 0) {
        const setsData: any = await fetchData("https://rebrickable.com/api/v3/lego/sets/");
        const sets: Set[] = setsData;
        await setsCollection.insertMany(sets);
    }
}

export async function Minifigs() {
    let cursor = client.db("lego").collection("minifigs").find<Minifig>({});
    let minifigs: Minifig[] = await cursor.toArray();
    return minifigs;
}

export async function Sets() {
    let cursor = client.db("lego").collection("sets").find<Set>({});
    let sets: Set[] = await cursor.toArray();
    return sets;
}

async function connect() { // start connection
    try {
        await client.connect();
        console.log("Connection with database started");
        await seed();
        process.on("SIGNINT", exit);
    } catch (e) {
        console.error(e);
    }
}

async function exit() { // this closes connection with DB on exit
    try {
        await client.close();
        console.log("Disconnected from database");
    } catch (e) {
        console.error(e)
    } finally {
        process.exit(0);
    }
}

export { connect, exit, registerUser }