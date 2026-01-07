/**
 * Marga Platform - Automated Firestore Backup
 * 
 * Runs daily at 2 AM Manila time (6 PM UTC)
 * Backs up entire Firestore database to Cloud Storage
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const {Firestore} = require('@google-cloud/firestore');

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = new Firestore();
const bucket = admin.storage().bucket();

/**
 * Scheduled backup function
 * Runs every day at 2 AM Manila time
 */
exports.scheduledFirestoreBackup = functions.pubsub
  .schedule('0 2 * * *') // Cron: Every day at 2 AM
  .timeZone('Asia/Manila')
  .onRun(async (context) => {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const projectId = process.env.GCLOUD_PROJECT;
    const bucketName = `gs://${projectId}.appspot.com`;
    const backupPath = `backups/firestore/${timestamp}`;

    console.log(`🔄 Starting Firestore backup: ${timestamp}`);

    try {
      // Export all collections to Cloud Storage
      const [operation] = await firestore.exportDocuments({
        outputUriPrefix: `${bucketName}/${backupPath}`,
        collectionIds: [] // Empty = export all collections
      });

      console.log(`✅ Backup started: ${operation.name}`);
      console.log(`📁 Location: ${bucketName}/${backupPath}`);

      // Optional: Delete backups older than 30 days
      await cleanupOldBackups(30);

      return {
        success: true,
        timestamp: timestamp,
        location: `${bucketName}/${backupPath}`
      };

    } catch (error) {
      console.error('❌ Backup failed:', error);
      throw error;
    }
  });

/**
 * Manual backup trigger (via HTTP)
 * Call this endpoint to trigger backup manually
 */
exports.manualFirestoreBackup = functions.https.onCall(async (data, context) => {
  // Verify admin authentication
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only admins can trigger backups'
    );
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const projectId = process.env.GCLOUD_PROJECT;
  const bucketName = `gs://${projectId}.appspot.com`;
  const backupPath = `backups/firestore/manual/${timestamp}`;

  console.log(`🔄 Manual backup triggered by: ${context.auth.uid}`);

  try {
    const [operation] = await firestore.exportDocuments({
      outputUriPrefix: `${bucketName}/${backupPath}`,
      collectionIds: data.collections || [] // Empty = all collections
    });

    console.log(`✅ Manual backup started: ${operation.name}`);

    return {
      success: true,
      timestamp: timestamp,
      location: `${bucketName}/${backupPath}`,
      operation: operation.name
    };

  } catch (error) {
    console.error('❌ Manual backup failed:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Restore from backup (manual trigger)
 */
exports.restoreFromBackup = functions.https.onCall(async (data, context) => {
  // Verify admin authentication
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only admins can restore backups'
    );
  }

  const { backupPath } = data;
  if (!backupPath) {
    throw new functions.https.HttpsError('invalid-argument', 'backupPath required');
  }

  const projectId = process.env.GCLOUD_PROJECT;
  const bucketName = `gs://${projectId}.appspot.com`;

  console.log(`🔄 Restore triggered by: ${context.auth.uid}`);
  console.log(`📁 From: ${bucketName}/${backupPath}`);

  try {
    const [operation] = await firestore.importDocuments({
      inputUriPrefix: `${bucketName}/${backupPath}`,
      collectionIds: data.collections || [] // Empty = all collections
    });

    console.log(`✅ Restore started: ${operation.name}`);

    return {
      success: true,
      operation: operation.name,
      source: `${bucketName}/${backupPath}`
    };

  } catch (error) {
    console.error('❌ Restore failed:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Cleanup old backups
 */
async function cleanupOldBackups(daysToKeep = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  console.log(`🗑️  Cleaning up backups older than ${daysToKeep} days`);

  const [files] = await bucket.getFiles({
    prefix: 'backups/firestore/'
  });

  let deletedCount = 0;

  for (const file of files) {
    const [metadata] = await file.getMetadata();
    const createdDate = new Date(metadata.timeCreated);

    if (createdDate < cutoffDate) {
      await file.delete();
      deletedCount++;
      console.log(`  Deleted: ${file.name}`);
    }
  }

  console.log(`✅ Deleted ${deletedCount} old backup files`);
}

/**
 * List available backups
 */
exports.listBackups = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const [files] = await bucket.getFiles({
    prefix: 'backups/firestore/'
  });

  const backups = await Promise.all(
    files
      .filter(file => file.name.endsWith('.overall_export_metadata'))
      .map(async file => {
        const [metadata] = await file.getMetadata();
        return {
          path: file.name.replace('.overall_export_metadata', ''),
          date: metadata.timeCreated,
          size: metadata.size
        };
      })
  );

  // Sort by date (newest first)
  backups.sort((a, b) => new Date(b.date) - new Date(a.date));

  return { backups };
});
