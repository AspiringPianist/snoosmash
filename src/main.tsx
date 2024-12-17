import { Devvit } from '@devvit/public-api';
import { useState } from '@devvit/public-api';

type LeaderboardEntry = {
  username: string;
  score: number;
  timestamp: number;
};

type WebViewMessage = {
  type: string;
  data: {
    username?: string;
    leaderboard?: LeaderboardEntry[];
    newScore?: number;
    finalScore?: number;
  };
};

Devvit.configure({
  redditAPI: true,
  redis: true,
  http: true,
  media: true
});

Devvit.addMenuItem({
  label: 'Create New Whack-A-Mole Game',
  location: 'subreddit',
  onPress: async (_event, context) => {
    const { reddit, ui } = context;
    const subreddit = await reddit.getCurrentSubreddit();
    const post = await reddit.submitPost({
      title: 'Whack-A-Snoo Game',
      subredditName: subreddit.name,
      preview: (
        <vstack height="100%" width="100%" alignment="middle center">
          <text size="large">Loading Game...</text>
        </vstack>
      ),
    });
    ui.showToast({ text: 'Game created!' });
    ui.navigateTo(post);
  },
});

Devvit.addCustomPostType({
  name: 'Whack-a-Snoo Game',
  height: 'tall',
  render: (context) => {
    const [username] = useState(async () => {
      const currUser = await context.reddit.getCurrentUser();
      return currUser?.username || 'Guest';
    });
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => []);
    const [webviewVisible, setWebviewVisible] = useState(false);

    // Load initial data
    useState(async () => {
      const currUser = await context.reddit.getCurrentUser();
      console.log('We got a userrr currUser' +  currUser?.username);
      const storedLeaderboard = await context.redis.get(`leaderboard_${context.postId}`);
      const parsedLeaderboard = storedLeaderboard ? JSON.parse(storedLeaderboard) : [];
      setLeaderboard(parsedLeaderboard);
      return currUser?.username ?? 'anon';
    });

    const updateLeaderboard = async (newScore: number, username: string) => {
      const entry: LeaderboardEntry = {
        username,
        score: newScore,
        timestamp: Date.now()
      };

      let updatedLeaderboard = [...leaderboard, entry];
      updatedLeaderboard.sort((a, b) => b.score - a.score);
      updatedLeaderboard = updatedLeaderboard.slice(0, 10);

      await context.redis.set(
        `leaderboard_${context.postId}`,
        JSON.stringify(updatedLeaderboard)
      );

      setLeaderboard(updatedLeaderboard);
    };

    const onMessage: Devvit.Blocks.OnWebViewEventHandler = (message) => {
      const msg = message as unknown as WebViewMessage;
      
      switch (msg.type) {
        case 'updateGameScore':
          if (msg.data.newScore && msg.data.username) {
            const existingEntry = leaderboard.find(entry => entry.username === msg.data.username);
            if (!existingEntry || msg.data.newScore > existingEntry.score) {
              updateLeaderboard(msg.data.newScore, msg.data.username);
            }
          }
          break;
        
        case 'gameOver':
          if (msg.data.finalScore && msg.data.username) {
            updateLeaderboard(msg.data.finalScore, msg.data.username);
          }
          break;
      }
    };

    const onShowWebviewClick = () => {
      setWebviewVisible(true);
      
      // Send data with a brief delay to ensure WebView is mounted
        console.log('Sending initial data:', { username, leaderboard });

        context.ui.webView.postMessage('myWebView', {
          type: 'initialData',
          data: {
            username: username,
            leaderboard: leaderboard
          },
        });
    };
    
    // WebView component with supported props
    <webview
      id="myWebView"
      url="page.html"
      onMessage={onMessage}
      grow
      height={webviewVisible ? '100%' : '0%'}
    />
    
    
    return (
      <vstack grow padding="small">
        <vstack
          grow={!webviewVisible}
          height={webviewVisible ? '0%' : '100%'}
          alignment="middle center"
        >
          <text size="xlarge" weight="bold">
            Whack-a-Snoo Game
          </text>
          <spacer />
          <vstack alignment="start middle">
            <hstack>
              <text size="medium">Username:</text>
              <text size="medium" weight="bold"> {username}</text>
            </hstack>
            
            <vstack padding="medium" cornerRadius="medium">
              <text size="large" weight="bold">Top Players</text>
              {leaderboard.map((entry, index) => (
                <hstack key={String(index)} gap="medium">
                  <text>{index + 1}.</text>
                  <text weight="bold">{entry.username}</text>
                  <text>{entry.score}</text>
                </hstack>
              ))}
            </vstack>
          </vstack>
          <spacer />
          <button onPress={onShowWebviewClick}>Play Game</button>
        </vstack>
        
        <vstack grow={webviewVisible} height={webviewVisible ? '100%' : '0%'}>
          <webview
            id="myWebView"
            url="page.html"
            onMessage={onMessage}
            grow
            height={webviewVisible ? '100%' : '0%'}
          />
        </vstack>
      </vstack>
    );
  },
});

export default Devvit;
