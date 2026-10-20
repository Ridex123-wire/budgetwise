
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";

initializeApp();

const db = getFirestore();

setGlobalOptions({ maxInstances: 10 });

export const addSavings = onCall(async (request) => {
  // Require the user to be signed in.
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must sign in before adding savings."
    );
  }

  const userId = request.auth.uid;
  const goalId = request.data?.goalId;
  const amount = request.data?.amount;

  // Validate the goal ID.
  if (
    typeof goalId !== "string" ||
    goalId.trim().length === 0 ||
    goalId.includes("/")
  ) {
    throw new HttpsError(
      "invalid-argument",
      "A valid savings goal ID is required."
    );
  }

  // Validate the contribution amount.
  if (
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1000000000
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Enter a valid positive savings amount."
    );
  }

  // Only access the signed-in user's savings goal.
  const goalRef = db.doc(
    `users/${userId}/savingsGoals/${goalId}`
  );

  await db.runTransaction(async (transaction) => {
    const goalSnapshot = await transaction.get(goalRef);

    if (!goalSnapshot.exists) {
      throw new HttpsError(
        "not-found",
        "Savings goal not found."
      );
    }

    const goal = goalSnapshot.data();

    // Check that the goal data exists.
    if (!goal) {
      throw new HttpsError(
        "not-found",
        "Savings goal data could not be found."
      );
    }

    // Validate the existing saved amount.
    if (
      typeof goal.saved !== "number" ||
      !Number.isFinite(goal.saved) ||
      goal.saved < 0
    ) {
      throw new HttpsError(
        "failed-precondition",
        "The existing savings amount is invalid."
      );
    }

    // Update the amount atomically on the server.
    transaction.update(goalRef, {
      saved: goal.saved + amount,
    });
  });

  return {
    success: true,
    message: "Savings contribution added successfully.",
  };
});
