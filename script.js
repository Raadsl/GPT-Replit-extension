const submit = document.getElementById("send-button")
const stopButton = document.getElementById("stop-button");
let stopAI = false;
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add_message(x, id=null) {
  const chatMessages = document.getElementById('chat-messages');

  // Find the existing message div with the specified ID, or create a new one
  let messageDiv = null;
  if (id !== null) {
    messageDiv = document.getElementById(`message-${id}`);
  }
  if (messageDiv === null) {
    messageDiv = document.createElement('div');
    messageDiv.classList.add('chat-message', x.type);
    if (id !== null) {
      messageDiv.id = `message-${id}`;
    }
    chatMessages.appendChild(messageDiv);
  }

  // Update the message content
  
  messageDiv.innerHTML = marked.parse(x.text);

  // Scroll to the bottom of the chat-messages div
  chatMessages.scrollTop = chatMessages.scrollHeight;
}


function getSelectedMode() {
  const selectElement = document.getElementById("mode");
  const selectedMode = selectElement.options[selectElement.selectedIndex].value;
  return selectedMode;
}

let messageCounter = 1;


async function fetchAssistantResponse(apiKey, mode, history) {
  return await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      'model': `gpt-${mode}`,
      'messages': history,
      'temperature': 0.7,
      'stream': true
    })
  });
}

async function getResp() {
  submit.disabled = true;
  stopButton.disabled = false;
  const file = await replit.me.filePath();
  const promptText = document.getElementById("user-message").value;
  messageCounter++;
  const messageId = messageCounter;
  add_message({ type: 'user-msg', text: escapeHtml(promptText) }, messageId);
  document.getElementById("user-message").value = "";
  const apiKey = document.getElementById("KEY").value;
  const history = extractMessages();
  // Add file content to history if available
  if (file) {
    let filecontent = await replit.fs.readFile(file, "utf8");
    if (filecontent.error) {
      await replit.messages.showError("Error reading file", 2000);
    }
    let newObj = {
      role: "system",
      content: `You are a helpful programming assistent called Replit-GPT. The user might ask something related to the contents of the file they opened you in (${file}). Here is the content:\n${filecontent.content}`
    };
    history.splice(1, 0, newObj);
  } else {
    let newObj = { role: "system", content: `You are a helpful programming assistent called Replit-GPT.` };
    history.splice(0, 0, newObj);
  }

  const mode = getSelectedMode();

  // Fetch response from API and process it
  try {
    const response = await fetchAssistantResponse(apiKey, mode, history);
    await processResponse(response, messageId);
  } catch (error) {
    console.error("Error fetching response:", error);
    messageCounter++;
    add_message({ type: 'error-msg', text: error }, messageCounter);
  }
  submit.disabled = false;
  stopButton.disabled = true;
}

async function processResponse(response, messageId) {
  const reader = response.body.getReader();
  let resp = '';
  let chunks = '';
  messageCounter++;
  while (true) {
    // Check if stopAI flag is set to true
    if (stopAI) {
      stopAI = false; // Reset the stopAI flag
      stopButton.disabled = true;
      break;
    }

    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks = new TextDecoder().decode(value);

    if (chunks.includes('data: [DONE]')) {
      break;
    }

    const regex = /^data:\s*(.+?)\s*$/gm;
    const jsonMatches = chunks.matchAll(regex);

    for (const jsonMatch of jsonMatches) {
      const jsonStr = jsonMatch[0].replace(/^data:\s*|\s*$/g, '');
      const { choices } = JSON.parse(jsonStr);

      for (const { delta } of choices) {
        const token = delta?.content;
        if (token) {
          resp += token;
          add_message({ type: 'received-msg', text: resp }, messageCounter);
        }
      }
    }
  }
}

function extractMessages() {
  const messageHistory = [];
  const chatMessages = document.getElementById('chat-messages');

  for (const messageElement of chatMessages.children) {
    const messageObject = {};

    if (messageElement.classList.contains('user-msg')) {
      messageObject.role = 'user';
    } else if (messageElement.classList.contains('received-msg')) {
      messageObject.role = 'assistant';
    } else if (messageElement.classList.contains('error-msg')) {
      messageObject.role = 'system';
    }

    messageObject.content = messageElement.textContent;
    messageHistory.push(messageObject);
  }


  console.log(messageHistory);
  return messageHistory;
}



submit.addEventListener("click", getResp);
var input = document.getElementById("user-message");
input.addEventListener("keypress", function(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    submit.click();
  }
});
stopButton.addEventListener("click", () => {
  stopAI = true;
});

async function main() {
  messageCounter++
  const file = await replit.me.filePath();
  if (file) {
    add_message({ type: 'received-msg', text: `Hi there, how can I help you? You can ask questions about the ${file} file` },1);
    await replit.messages.showConfirm("Replit-GPT loaded", 2000);
    await replit.messages.showNotice("The content of the file will be passed to the AI to improve performance!", 2000);
  } else {
    add_message({ type: 'received-msg', text: 'Hi there, how can I help you?' },1);
    await replit.messages.showConfirm("Replit-GPT loaded", 2000);
  }
  console.log("[Replit-GPT] loaded! V1.1")
}


// Get the password input element
const passwordInput = document.getElementById('KEY');

// Check if the password is already saved in the local storage
const savedPassword = localStorage.getItem('OPENAI-API-KEY_GPT-REPLIT|V1.1');
if (savedPassword) {
  // If the password is saved, set it as the value of the password input
  passwordInput.value = savedPassword;
}

// Listen for changes to the password input
passwordInput.addEventListener('input', () => {
  // When the password is changed, save it to the local storage
  localStorage.setItem('password', passwordInput.value);
});
main()