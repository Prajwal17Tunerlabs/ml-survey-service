/**
 * Migration: Normalize userRoles.code to lowercase
 * - Uses createdAt to determine newest document
 * - Retains newest doc
 * - Deletes older duplicates
 */

const { MongoClient } = require("mongodb")

const MONGODB_URL = process.env.MONGODB_URL
const COLLECTION_NAME = "userRoles"

async function migrate() {
  const client = new MongoClient(MONGODB_URL)

  try {
    await client.connect()
    console.log("Connected to MongoDB")

    const db = client.db()
    const collection = db.collection(COLLECTION_NAME)

    // Fetch all documents
    const roles = await collection.find({}).toArray()

    // Group documents by normalized (lowercase) code
    const grouped = roles.reduce((acc, doc) => {
      if (!doc.code) return acc

      const normalizedCode = doc.code.toLowerCase()
      acc[normalizedCode] = acc[normalizedCode] || []
      acc[normalizedCode].push(doc)

      return acc
    }, {})

    for (const [normalizedCode, docs] of Object.entries(grouped)) {
      // Sort by createdAt DESC (newest first)
      docs.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      )

      const [latestDoc, ...olderDocs] = docs

      // Update only the latest document
      await collection.updateOne(
        { _id: latestDoc._id },
        { $set: { code: normalizedCode } }
      )

      // Delete older duplicates
      if (olderDocs.length > 0) {
        const deleteIds = olderDocs.map(doc => doc._id)

        await collection.deleteMany({
          _id: { $in: deleteIds }
        })

        console.log(
          `Code '${normalizedCode}': kept ${latestDoc._id}, deleted ${deleteIds.length} older doc(s)`
        )
      }
    }

    console.log("Migration completed successfully")
  } catch (error) {
    console.error("Migration failed:", error)
  } finally {
    await client.close()
  }
}

migrate()
