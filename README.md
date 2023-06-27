# GPT-Replit
## Now verified in the replit store
"A little ChatGPT in your Replit editor. If you a file with it the file contents will be passed to the AI so you can ask questions about it."

It reponds with live updating text, there's a stop button to stop the AI from responding, and it is able to use GPT-4, GPT-4 32k & GPT-3.5 (if you have them". You can click on the 3 dots at a file if the extension is installed and click on "Open with GPT-Replit". Now you are able to ask the AI to fix an error in the file, add new stuff and more.
It uses the current Replit theme you use, and you can use your voice! Also double click to copy code!

V1.4

## Settings.gptreplit
The settings.gptreplit file is an optional configuration file for the Replit-GPT chatbot. It contains plain text key-value pairs.

Example:
```
temperature:0.8
model:gpt-4-0613
```

Settings
```
temperature: Controls randomness of GPT model (0.1-2.0). Default: 0.7.

model: GPT model to be used. Default: "gpt-3.5-turbo". Can also be set using the interface, but this allows you to use more modals than just "gpt-3.5-turbo", "gpt-4", "gpt-4-32k". For example you can say `gpt-4-0613` or `gpt-3.5-turbo-16k`. **Note:** It has to be an OpenAI chatmodel. Models like `text-davinci-003` won't work
```

