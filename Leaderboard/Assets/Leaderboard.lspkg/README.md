![Leaderboard](AssetImage/Leaderboard.png)

# Leaderboard

A cloud-connected leaderboard system for creating competitive multiplayer experiences on Spectacles. This package provides score submission, retrieval, ranking, and UI components for displaying high scores with persistent storage via Snap's cloud services.

## Features

- **Cloud-Backed Persistence**: Scores stored in Snap's backend infrastructure
- **Score Submission**: Submit scores with automatic ranking and timestamp
- **Leaderboard Retrieval**: Fetch top scores with configurable limits
- **Grid UI Component**: Pre-built scrollable leaderboard display
- **Rank Tracking**: Automatic position calculation and tie-breaking
- **User Identification**: Anonymous or user-authenticated score tracking
- **Async Operations**: Promise-based API for non-blocking score operations
- **Demo UI**: Interactive example with create, load, submit, and display functionality

## Quick Start

Create a basic leaderboard with score submission:

```typescript
import {LeaderboardExample} from "Leaderboard.lspkg/Scripts/LeaderboardExample";

@component
export class SimpleLeaderboard extends BaseScriptComponent {
  @input leaderboardName: string = "my_game_scores";
  @input submitButton: Interactable;
  @input displayText: Text;

  private leaderboard: LeaderboardExample;

  onAwake() {
    // Create leaderboard component
    this.leaderboard = this.sceneObject.createComponent("LeaderboardExample");
    this.leaderboard.leaderboardName = this.leaderboardName;

    // Initialize leaderboard
    this.leaderboard.createLeaderboard().then(() => {
      print("Leaderboard created successfully");
    }).catch((error) => {
      print(`Error creating leaderboard: ${error}`);
    });

    // Submit score on button press
    this.submitButton.onTriggerStart.add(() => {
      const score = Math.floor(Math.random() * 1000);
      this.submitScore(score);
    });
  }

  async submitScore(score: number) {
    try {
      await this.leaderboard.submitScore(score);
      print(`Score ${score} submitted!`);
      await this.displayTopScores();
    } catch (error) {
      print(`Error submitting score: ${error}`);
    }
  }

  async displayTopScores() {
    const scores = await this.leaderboard.getLeaderboard(10);
    let displayString = "Top 10 Scores:\n";
    scores.forEach((entry, index) => {
      displayString += `${index + 1}. ${entry.score}\n`;
    });
    this.displayText.text = displayString;
  }
}
```

## Script Highlights

### LeaderboardExample.ts
The core leaderboard manager that handles all cloud operations for score persistence. Provides methods for creating new leaderboards (createLeaderboard), submitting scores with automatic ranking (submitScore), and retrieving top scores with configurable limits (getLeaderboard). The component manages leaderboard IDs, handles authentication states, and implements retry logic for network operations. Scores are stored with timestamps for tie-breaking and can include optional metadata like player names or session data.

### LeaderboardDemo.ts
A complete UI controller that demonstrates leaderboard functionality with interactive buttons and text fields. Connects SIK Interactable buttons to leaderboard operations including create, load, submit score, and display top scores. The demo validates user inputs from text fields, handles async operations with loading states, and provides visual feedback for all operations. Includes debug logging for troubleshooting and error handling for network failures.

### GridContentCreatorLeaderboard.ts
A specialized UI component that generates scrollable leaderboard displays with automatic layout. Creates individual rank entries with position number, score value, and optional player information. The grid dynamically adjusts to the number of entries and handles overflow with scrolling. Integrates with SpectaclesUIKit for consistent visual styling and supports customizable entry templates for different game aesthetics.

### LeaderboardItemExample.ts
Defines the data structure and visual representation for individual leaderboard entries. Each item contains rank position, score value, player identifier, and timestamp. The component handles formatting large numbers with separators, converting timestamps to readable dates, and highlighting the current player's score. Supports custom styling for different rank tiers (gold/silver/bronze for top 3).

## Core API Methods

### LeaderboardExample

```typescript
// Create or initialize a leaderboard
createLeaderboard(): Promise<void>

// Load an existing leaderboard by name
loadLeaderboard(name: string): Promise<void>

// Submit a score for the current user
submitScore(score: number): Promise<void>

// Get top N scores
getLeaderboard(limit: number): Promise<LeaderboardEntry[]>

// Get user's personal best
getUserBestScore(): Promise<number>

// Clear all scores (admin only)
clearLeaderboard(): Promise<void>
```

### LeaderboardEntry

```typescript
interface LeaderboardEntry {
  rank: number
  score: number
  userId: string
  timestamp: number
  metadata?: any
}
```

## Advanced Usage

### Real-Time Competitive Game

Create a timed challenge with live leaderboard updates:

```typescript
@component
export class TimedChallenge extends BaseScriptComponent {
  @input leaderboard: LeaderboardExample;
  @input scoreText: Text;
  @input timerText: Text;
  @input leaderboardGrid: GridContentCreatorLeaderboard;

  private currentScore = 0;
  private timeRemaining = 60;
  private gameActive = false;

  onAwake() {
    this.leaderboard.createLeaderboard().then(() => {
      print("Challenge leaderboard ready");
      this.startGame();
    });
  }

  startGame() {
    this.gameActive = true;
    this.currentScore = 0;

    // Game timer
    const updateEvent = this.createEvent("UpdateEvent");
    updateEvent.bind(() => {
      if (!this.gameActive) return;

      this.timeRemaining -= getDeltaTime();
      this.timerText.text = `Time: ${Math.ceil(this.timeRemaining)}s`;

      if (this.timeRemaining <= 0) {
        this.endGame();
      }
    });

    // Simulate scoring events
    const scoreEvent = this.createEvent("UpdateEvent");
    scoreEvent.bind(() => {
      if (!this.gameActive) return;

      if (Math.random() < 0.02) {  // 2% chance per frame
        this.currentScore += 10;
        this.scoreText.text = `Score: ${this.currentScore}`;
      }
    });
  }

  async endGame() {
    this.gameActive = false;
    print(`Game over! Final score: ${this.currentScore}`);

    try {
      await this.leaderboard.submitScore(this.currentScore);
      await this.displayResults();
    } catch (error) {
      print(`Error submitting final score: ${error}`);
    }
  }

  async displayResults() {
    const topScores = await this.leaderboard.getLeaderboard(10);
    const userRank = topScores.findIndex(entry => entry.score === this.currentScore) + 1;

    print(`You ranked #${userRank} out of ${topScores.length}!`);
    this.leaderboardGrid.populateGrid(topScores);
  }
}
```

### Multi-Category Leaderboards

Track different score types with separate leaderboards:

```typescript
@component
export class MultiCategoryScores extends BaseScriptComponent {
  @input highScoreBoard: LeaderboardExample;
  @input fastestTimeBoard: LeaderboardExample;
  @input accuracyBoard: LeaderboardExample;

  private gameStats = {
    score: 0,
    time: 0,
    accuracy: 0
  };

  onAwake() {
    // Initialize all leaderboards
    this.highScoreBoard.leaderboardName = "high_scores";
    this.fastestTimeBoard.leaderboardName = "fastest_times";
    this.accuracyBoard.leaderboardName = "best_accuracy";

    Promise.all([
      this.highScoreBoard.createLeaderboard(),
      this.fastestTimeBoard.createLeaderboard(),
      this.accuracyBoard.createLeaderboard()
    ]).then(() => {
      print("All leaderboards initialized");
    });
  }

  async submitGameResults(score: number, time: number, accuracy: number) {
    this.gameStats = { score, time, accuracy };

    try {
      // Submit to all relevant leaderboards
      await Promise.all([
        this.highScoreBoard.submitScore(score),
        this.fastestTimeBoard.submitScore(Math.floor(time * 1000)),  // Convert to ms
        this.accuracyBoard.submitScore(Math.floor(accuracy * 100))   // Convert to percentage
      ]);

      print("Results submitted to all leaderboards");
      await this.checkNewRecords();
    } catch (error) {
      print(`Error submitting results: ${error}`);
    }
  }

  async checkNewRecords() {
    const [scoreRank, timeRank, accuracyRank] = await Promise.all([
      this.getUserRank(this.highScoreBoard, this.gameStats.score),
      this.getUserRank(this.fastestTimeBoard, this.gameStats.time),
      this.getUserRank(this.accuracyBoard, this.gameStats.accuracy)
    ]);

    if (scoreRank === 1) print("NEW HIGH SCORE RECORD!");
    if (timeRank === 1) print("NEW SPEED RECORD!");
    if (accuracyRank === 1) print("NEW ACCURACY RECORD!");
  }

  async getUserRank(leaderboard: LeaderboardExample, score: number): Promise<number> {
    const topScores = await leaderboard.getLeaderboard(100);
    return topScores.findIndex(entry => entry.score === score) + 1;
  }
}
```

### Friend Comparison Widget

Display scores compared to friends with percentile rankings:

```typescript
@component
export class FriendComparison extends BaseScriptComponent {
  @input leaderboard: LeaderboardExample;
  @input comparisonText: Text;
  @input friendIds: string[];

  async showComparison(userScore: number) {
    try {
      const allScores = await this.leaderboard.getLeaderboard(1000);
      const friendScores = allScores.filter(entry =>
        this.friendIds.includes(entry.userId)
      );

      // Calculate percentile
      const rank = allScores.findIndex(entry => entry.score === userScore) + 1;
      const percentile = ((allScores.length - rank) / allScores.length) * 100;

      // Find closest friends
      const aboveYou = friendScores.filter(f => f.score > userScore)[0];
      const belowYou = friendScores.filter(f => f.score < userScore).reverse()[0];

      let comparisonString = `Your Score: ${userScore} (Top ${percentile.toFixed(1)}%)\n\n`;

      if (aboveYou) {
        const diff = aboveYou.score - userScore;
        comparisonString += `Beat ${aboveYou.userId}'s score by ${diff} points!\n`;
      }

      if (belowYou) {
        const diff = userScore - belowYou.score;
        comparisonString += `You're ${diff} points ahead of ${belowYou.userId}\n`;
      }

      this.comparisonText.text = comparisonString;
    } catch (error) {
      print(`Error loading friend comparison: ${error}`);
    }
  }
}
```

## Built with 👻 by the Spectacles team



