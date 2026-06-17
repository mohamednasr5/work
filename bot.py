name: El Ashry Bot - Deploy

on:
  push:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 300

    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
    
    - name: Create .env file
      run: |
        cat > .env << EOF
        BOT_TOKEN=${{ secrets.BOT_TOKEN }}
        FIREBASE_URL=${{ secrets.FIREBASE_URL }}
        FIREBASE_CREDENTIALS_JSON=${{ secrets.FIREBASE_CREDENTIALS_JSON }}
        CHANNEL_ID=${{ secrets.CHANNEL_ID }}
        BOT_PASSWORD=${{ secrets.BOT_PASSWORD }}
        EOF
    
    - name: Run bot
      env:
        BOT_TOKEN: ${{ secrets.BOT_TOKEN }}
        FIREBASE_URL: ${{ secrets.FIREBASE_URL }}
        FIREBASE_CREDENTIALS_JSON: ${{ secrets.FIREBASE_CREDENTIALS_JSON }}
        CHANNEL_ID: ${{ secrets.CHANNEL_ID }}
        BOT_PASSWORD: ${{ secrets.BOT_PASSWORD }}
      run: python bot_merged.py
