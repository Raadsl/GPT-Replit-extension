//gl reading lol
const submit = document.getElementById("send-button")
const stopButton = document.getElementById("stop-button");
let maxContent = 4000 * 2
let stopAI = false;
let isGenerating = false;
let voice = false;
let lastID = {}
const useFiles = {};
const multiModals = ["gpt-4o", "gpt-4-turbo"]

let clickTimer = null;

function escapeHtml(unsafe) {
  let clean = unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  return DOMPurify.sanitize(clean, { USE_PROFILES: { html: true } });
}

async function copyCodeBlocks(codeBlock, event) {
  const textToCopy = codeBlock.textContent;
  const selection = window.getSelection();
  const range = document.createRange();

  range.selectNodeContents(codeBlock);
  selection.removeAllRanges();
  selection.addRange(range);

  try {
    await navigator.clipboard.writeText(textToCopy);
      triggerConfetti(event);
    if (lastID.copy) {
      await replit.messages.hideMessage(lastID.copy);
    }
    lastID.copy = await replit.messages.showConfirm("Codeblock copied!", 1500);
  } catch (err) {
    console.error('Failed to copy text:', err);
    if (lastID.copy) {
      await replit.messages.hideMessage(lastID.copy);
    }
    lastID.copy = await replit.messages.showNotice("Failed to copy codeblock. Error: " + err.message, 1500);
  }
}



function triggerConfetti(event) {
  const origin = {
    y: (event.clientY / window.innerHeight),
    x: (event.clientX / window.innerWidth)
  };

  confetti({
    particleCount: 30,
    angle: 180,
    spread: 55,
    origin
  });
  confetti({
    particleCount: 30,
    angle: 0,
    spread: 55,
    origin
  });
}


function getSelectedTextWithin(element) {
  let text = "";
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    // Check if the selection is within the specified element
    if (element.contains(range.commonAncestorContainer)) {
      text = selection.toString();
    }
  }
  return text;
}

function exportMessageHistory() {
  const messageHistory = extractMessages();
  const dataStr = JSON.stringify(messageHistory);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement('a');
  link.download = 'messageHistory-GPTReplit.json';
  link.href = url;
  link.click();
}

async function importMessageHistory(event) {
  await clearMessages();
  messageCounter = 1;
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = (event) => {
    const messages = JSON.parse(event.target.result);

    messages.forEach(message => {
      if (message.role === "assistant") {
        const messageText = message.content.map(part => part.text).join(" "); 
        addMessage({ type: "received-msg", text: messageText });
      } else {
        const messageText = message.content.map(part => part.text).join(" "); 
        addMessage({ type: message.role + "-msg", text: messageText });
      }
    });
  };
  reader.readAsText(file);
  if (lastID.importmessage) {
    await replit.messages.hideMessage(lastID.clear)
  }
  lastID.importmessage = await replit.messages.showConfirm("Successfully imported a new message history", 1500);
}


document.getElementById('settings-btn').addEventListener('click', () => {
  document.getElementById('settings-modal').style.display = 'block';
});

document.getElementById('export-messages-button').addEventListener('click', exportMessageHistory);

document.getElementById('import-messages-button').addEventListener('click', () => {
  document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', importMessageHistory);


function addMessage(x, id = null) {
  const chatMessages = document.getElementById('chat-messages');
  const isNearBottom = chatMessages.scrollHeight - chatMessages.clientHeight - chatMessages.scrollTop < 60;
  let messageDiv = null;
  const maxLength = 5000; 
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
  messageDiv.dataset.fullText = x.text;
  if (x.text.length > maxLength && x.type == "user-msg") {
    const truncatedText = x.text.substring(0, maxLength) + '...';
    const readMoreButton = document.createElement('button');
    readMoreButton.innerText = 'Read More';
    readMoreButton.classList.add('button');
    readMoreButton.onclick = () => {
      messageDiv.innerHTML = DOMPurify.sanitize(marked.parse((x.text), { mangle: false, headerIds: false }), { USE_PROFILES: { html: true } });
      MathJax.typesetPromise([messageDiv]);
      hljs.highlightAll();
    };
    messageDiv.innerHTML = DOMPurify.sanitize(marked.parse((truncatedText), { mangle: false, headerIds: false }), { USE_PROFILES: { html: true } });
    messageDiv.appendChild(readMoreButton);
  } else {
    if (!x.noMD) {
      messageDiv.innerHTML = DOMPurify.sanitize(marked.parse((x.text), { mangle: false, headerIds: false }), { USE_PROFILES: { html: true } });
    } else {
      messageDiv.innerHTML = DOMPurify.sanitize(x.text, { USE_PROFILES: { html: true } });
    }
  }


  MathJax.typesetPromise([messageDiv])

  const codeBlocks = messageDiv.querySelectorAll('pre code');
  codeBlocks.forEach((codeBlock, index) => {

    const settings = loadRawSettings();
    const copyButtonSetting = settings && settings.copyButton;

    const copyButton = document.createElement('button');
    copyButton.innerHTML = '<i class="fa-solid fa-copy"></i>';
    copyButton.classList.add('button');
    copyButton.title = 'Click to copy'
    copyButton.style.position = 'absolute';
    copyButton.style.top = '0';
    copyButton.style.right = '0';

    const footer = document.createElement('div');
    footer.innerText = 'Double-click to copy';
    footer.style.fontSize = '0.8em';
    footer.style.textAlign = 'right';


    if (copyButtonSetting) {
      copyButton.addEventListener('click', (event) => copyCodeBlocks(codeBlock, event));
      codeBlock.parentNode.style.position = 'relative';
      codeBlock.parentNode.appendChild(copyButton);
    } else {
      codeBlock.addEventListener('dblclick', (event) => copyCodeBlocks(codeBlock, event));
      codeBlock.parentNode.appendChild(footer);
    }


  });
  if (x.image) {
    const img = document.createElement('img');
    img.src = x.image;
    img.classList.add("user-upload-image");
    img.alt = "User uploaded image";
    messageDiv.appendChild(img);
    const container = document.getElementById('image-preview-container');
    container.style.display = 'none';
    base64Image = null;
    document.getElementById('image-preview').src = '';
  } else {
    const container = document.getElementById('image-preview-container');
    container.style.display = 'none';
    base64Image = null;
    document.getElementById('image-preview').src = '';
  }
  if (isNearBottom) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  hljs.highlightAll();
}

function playAudio(audioUrl) {
  const audio = new Audio(audioUrl);
  audio.play();
}
//perf

function batchDOMUpdates(updates) {
  const fragment = document.createDocumentFragment();
  updates.forEach(update => {
    const element = document.createElement(update.tag);
    element.innerHTML = update.content;
    fragment.appendChild(element);
  });
  document.getElementById('chat-messages').appendChild(fragment);
}


async function clearMessages() {
  if (isGenerating) {
    replit.messages.showWarning("Cannot clear messages while generating a response!", 2000);
    return;
  }

  const chatMessages = document.getElementById('chat-messages');
  while (chatMessages.firstChild) {
    chatMessages.removeChild(chatMessages.firstChild);
  }

  messageCounter = 1;
  if (lastID.clear) {
    await replit.messages.hideMessage(lastID.clear)
  }
  lastID.clear = await replit.messages.showConfirm("Cleared message history successfully!", 1500);
}


function startVoiceInput() {
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  voice = true;
  recognition.onresult = (event) => {
    const speechResult = event.results[0][0].transcript;
    document.getElementById('user-message').value = speechResult;
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
  };

  recognition.start();
}

// Check if the browser supports SpeechRecognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition) {
  console.error('Your browser does not support the Web Speech API. Please use a supported browser, such as Google Chrome or Microsoft Edge.');
  document.getElementById('voice-input-button').disabled = true;
  document.getElementById('voice-input-button').title = `Your browser does not support the Web Speech API. Please use a supported browser, such as Google Chrome or Microsoft Edge.`;
} else {
  document.getElementById('voice-input-button').addEventListener('click', startVoiceInput);
}
const clearMessagesButton = document.getElementById('clear-messages-button');
clearMessagesButton.addEventListener('click', clearMessages);

async function getSelectedMode() {
  const settings = loadSettings();
  if (settings && settings.model) {
    return settings.model;
  } else {
    const selectElement = document.getElementById("mode");
    const selectedMode = selectElement.options[selectElement.selectedIndex].value;
    return selectedMode;
  }
}

let messageCounter = 1;

async function fetchAssistantResponse(apiKey, mode, history, temperature, server) {
  console.log(apiKey, mode, history, temperature, server)
  if (!server) {
    server = 'api.openai.com'
  }
  try {
    let response = await fetch(`https://${server}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        'model': mode,
        'messages': history,
        'temperature': parseFloat(temperature),
        'stream': true
      })
    });
    if (!response.ok) {
      console.log(`HTTP error! status: ${response.status}`)
    }
    console.log(response)
    return response;

  } catch (error) {
    console.log('There was a problem with the fetch operation: ' + error.message);
    console.log(error)
    toggleGenerating(false)
  }
}

function toggleGenerating(value) {
  const headerBanner = document.getElementById("headerbanner")
  isGenerating = value
  if(value == true) {
      headerBanner.innerHTML = `<div id="loading-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
  } else {
    headerBanner.innerHTML = `GPT-Replit`;
  }
}



async function getResp() {
  submit.disabled = true;
  stopButton.disabled = false;
  stopAI = false;
  toggleGenerating(true);
  closeAllOptions()
  const promptText = document.getElementById("user-message").value;
  if (promptText == "" || promptText == " ") {
    submit.disabled = false;
    stopButton.disabled = true;
    stopAI = false;
    toggleGenerating(false);
    return;
  }
  messageCounter++;
  
  const messageId = messageCounter;
  const selectedMode = await getSelectedMode();
  if(base64Image && multiModals.includes(selectedMode)) {
    addMessage({ type: 'user-msg', text: escapeHtml(promptText), noMD: true, image: base64Image }, messageId);
    
  } else {
    addMessage({ type: 'user-msg', text: escapeHtml(promptText), noMD: true }, messageId);
  }
  document.getElementById("user-message").value = "";
  const apiKey = document.getElementById("KEY").value;
  const yapsettings = loadRawSettings();
  let noyap = "";
  if (yapsettings && yapsettings.hasOwnProperty("noyap") && yapsettings.noyap) {
    noyap = `No yapping, so keep your answers as short as possible. `;
  }
  
  let systemMessage = `You are a helpful programming assistant called Replit-GPT. ${noyap}`;
  const fileContents = {};
  const history = extractMessages();
  if (Object.keys(useFiles).length > 0) {
      let filesInfo = [];
      for (const filePath in useFiles) {
          if (useFiles[filePath]) {
              let fileContent = await replit.fs.readFile(filePath, "utf8");
              if (fileContent.error) {
                  await replit.messages.showError(`Error reading file ${filePath}`, 2000);
              } else {
                  fileContents[filePath] = fileContent.content;
                  let previewLength = Math.floor((maxContent / Object.keys(fileContents).length) - 1000);
                  filesInfo.push(`- File path: ${filePath}\n- File Content Preview: \`\`\`${fileContent.content.substring(0, previewLength)}\`\`\``);
              }
          }
      }

      if (filesInfo.length > 0) {
          systemMessage += " The user might ask something related to the contents of the following file(s):\n" + filesInfo.join('\n');
      }
  }

  history.unshift({ role: "system", content: systemMessage });


  const mode = await getSelectedMode();
  const settings = loadRawSettings();
  const customTemperature = settings && settings.temperature ? parseFloat(settings.temperature) : 0.7;
  let rawsettings = loadRawSettings();
  if (rawsettings == null) {
    rawsettings = {
      server: 'api.openai.com'
    };
  }
  try {
    const response = await fetchAssistantResponse(apiKey, mode, history, customTemperature, rawsettings.server);
    if (response.status !== 200) {
      const errorResponse = await response.json();
      throw new Error(errorResponse.error.message);
    }
    await processResponse(response);
  } catch (error) {
    console.log(`Error fetching response: ${error}`);
    toggleGenerating(false);
    messageCounter++;
    addMessage({ type: 'error-msg', text: `Error fetching response, ${error.message}` }, messageCounter);
  }

  submit.disabled = false;
  stopButton.disabled = true;
}


async function processResponse(response) {
  const reader = response.body.getReader();
  let result = '';
  messageCounter++
  if (voice) {
    playAudio("woosh.mp3")
  }
  while (true) {
    // Check if stopAI flag is set to true
    if (stopAI) {
      stopAI = false;
      toggleGenerating(false);
      stopButton.disabled = true;
      replit.messages.showWarning("Stopped generating!", 1000);
      break;
    }

    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    const chunk = new TextDecoder().decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.includes('data: [DONE]')) {
        break;
      }
      if (line.startsWith('data:')) {
        const jsonStr = line.slice(5);
        try {
          const data = JSON.parse(jsonStr);
          if (data.choices) {
            for (const { delta } of data.choices) {
              if (delta.content) {
                result += delta.content;
              }
            }
          }
            addMessage({ type: 'received-msg', text: result }, messageCounter);
        } catch (error) {
          console.log(`Error parsing JSON: ${error}`);
        }
      }
    }
  }
  toggleGenerating(false)
  messageCounter++;
}


  function extractMessages() {
    const messageHistory = [];
    const chatMessages = document.getElementById('chat-messages').children;
    const mode = document.getElementById("mode").value; // Make sure this element exists and captures the current model

    for (const messageElement of chatMessages) {
      // Read the full message text from the data attribute
      let messageText = messageElement.dataset.fullText.trim();

      const messageContents = [];
      const images = messageElement.getElementsByClassName('user-upload-image');

      if (multiModals.includes(mode) && images.length > 0) {
        messageText += "[ image uploaded by user using another GPT model able to see images. ]";
      }

      messageContents.push({
        type: 'text',
        text: messageText
      });

      if (multiModals.includes(mode)) {
        for (const img of images) {
          messageContents.push({
            type: 'image_url',
            image_url: { url: img.src }
          });
        }
      }

      const messageObject = {
        role: messageElement.classList.contains('user-msg') ? 'user' : (messageElement.classList.contains('system-msg') ? 'system' : 'assistant'),
        content: messageContents
      };

      messageHistory.push(messageObject);
    }

    return messageHistory;
  }




submit.addEventListener("click", getResp); //!!!!
var input = document.getElementById("user-message");

input.addEventListener("keypress", function(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    submit.click();
  }
});


stopButton.addEventListener("click", () => {
  stopAI = true;
});

async function getEncryptionKey() {
  try {
    const { user } = await replit.data.currentUser({});
    return user.id.toString() + "GPT-REPLIT-SALT";
  } catch (error) {
    console.error("Error fetching user data:", error);
    return "DEFAULT-ENCRYPTION-KEY";
  }
}

async function encryptApiKey(apiKey) {
  const key = await getEncryptionKey();
  let encryptedKey = '';
  for (let i = 0; i < apiKey.length; i++) {
    const charCode = apiKey.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    encryptedKey += String.fromCharCode(charCode);
  }
  return btoa(encryptedKey);
}

async function decryptApiKey(encryptedApiKey) {
  const key = await getEncryptionKey();
  const decodedKey = atob(encryptedApiKey);
  let decryptedKey = '';
  for (let i = 0; i < decodedKey.length; i++) {
    const charCode = decodedKey.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    decryptedKey += String.fromCharCode(charCode);
  }
  return decryptedKey;
}

const passwordInput = document.getElementById('KEY');
const NEW_STORAGE_KEY = 'ENCRYPTED-OPENAI-API-KEY_GPT-REPLIT';
const OLD_STORAGE_KEY = 'OPENAI-API-KEY_GPT-REPLIT|V1.5.3';
const LEGACY_STORAGE_KEY = 'OPENAI-API-KEY_GPT-REPLIT';

async function loadApiKey() {
  // Try to load the encrypted key first
  const encryptedApiKey = localStorage.getItem(NEW_STORAGE_KEY);
  if (encryptedApiKey) {
    try {
      const decryptedApiKey = await decryptApiKey(encryptedApiKey);
      passwordInput.value = decryptedApiKey;
      replit.messages.showNotice("Loaded encrypted OpenAI API Key from previous session.", 1000);
      return;
    } catch (error) {
      console.error('Error decrypting API key:', error);
    }
  }

  // If no encrypted key, try to load the unencrypted key
  const unencryptedApiKey = localStorage.getItem(OLD_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  if (unencryptedApiKey) {
    passwordInput.value = unencryptedApiKey;
    replit.messages.showNotice("Loaded unencrypted OpenAI API Key from previous session. It will be encrypted for future use.", 5000);

    // Encrypt and save the key for future use
    await saveApiKey();

    // Remove the old unencrypted keys
    localStorage.removeItem(OLD_STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
}

async function saveApiKey() {
  const apiKey = passwordInput.value;
  if (apiKey) {
    try {
      const encryptedApiKey = await encryptApiKey(apiKey);
      localStorage.setItem(NEW_STORAGE_KEY, encryptedApiKey);
    } catch (error) {
      console.error('Error encrypting API key:', error);
      replit.messages.showError("Failed to save encrypted API key.", 1500);
    }
  } else {
    localStorage.removeItem(NEW_STORAGE_KEY);
  }
}

// Call loadApiKey when the page loads
loadApiKey();

// Add event listener to save the API key when it changes
passwordInput.addEventListener('change', saveApiKey);

function truncateFilename(filename, maxLength) {
  if (filename.length <= maxLength) {
    return filename;
  }

  const middle = maxLength / 2;
  const start = filename.slice(0, middle - 1);
  const end = filename.slice(-middle + 2);
  return `${start}...${end}`;
}

async function updateInputMaxLength() {
    const userMessageInput = document.getElementById("user-message");
    const selectedMode = await getSelectedMode();
    const uploadButton = document.getElementById('upload-image-button');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const deleteImageButton = document.getElementById('delete-image');

    // Reset image preview and hide container when model changes
    function resetImageUI() {
        imagePreviewContainer.style.display = 'none';
        deleteImageButton.style.display = 'none';
        base64Image = null;
        document.getElementById('image-preview').src = '';
        closeAllOptions();
    }

    if (selectedMode === "gpt-3.5-turbo") { 
        userMessageInput.maxLength = 15000 * 3;
        maxContent = 15000 * 3;
        localStorage.setItem('selectedMode', selectedMode);
        uploadButton.style.display = 'none';
        resetImageUI();
    } else if (selectedMode === "gpt-4") {
        userMessageInput.maxLength = 7500 * 3;
        maxContent = 7500 * 3;
        localStorage.setItem('selectedMode', selectedMode);
        uploadButton.style.display = 'none';
        resetImageUI();
    } else if (selectedMode === "gpt-4-32k") {
        userMessageInput.maxLength = 31500 * 3;
        maxContent = 27000 * 3;
        localStorage.setItem('selectedMode', selectedMode);
        uploadButton.style.display = 'none';
        resetImageUI();
    } else if (selectedMode === "gpt-4-turbo") {
        userMessageInput.maxLength = 125000 * 3;
        maxContent = 125000 * 3;
        localStorage.setItem('selectedMode', selectedMode);
        uploadButton.style.display = 'block';
    } else if (selectedMode === "gpt-4o") {
      userMessageInput.maxLength = 200000 * 3;
      maxContent = 200000 * 3;
      localStorage.setItem('selectedMode', selectedMode);
      uploadButton.style.display = 'block';
    }
    else {
        userMessageInput.maxLength = 15000 * 3; // Default case
        maxContent = 15000 * 3; // Default case
        localStorage.setItem('selectedMode', selectedMode);
        uploadButton.style.display = 'none';
        resetImageUI();
    }
}
document.getElementById('file-search-input').addEventListener('change', function () {
  filterFiles(false)
});



async function updateAvailableFiles(dropdown, path = './') {
  while (dropdown.options.length > 0) { 
    dropdown.remove(0);
  }
  const excludedFileExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.mp3', '.mp4', '.svg', '.pdf', '.xlsx', '.pptx', '.zip', '.rar', '.svg'];
  const excludedDirectories = ['node_modules', '.git', 'venv', 'dist', 'build'];

  const option = document.createElement('option');
  option.text = 'Choose file';
  option.disabled = true;
  option.selected = true;
  dropdown.appendChild(option);

  async function processDirectory(path) {
    const entries = await replit.fs.readDir(path);

    for (const entry of entries.children) {
      if (entry.type === 'DIRECTORY' && !entry.filename.startsWith(".") && !excludedDirectories.includes(entry.filename)) {
        await processDirectory(`${path}${entry.filename}/`);
      } else if (entry.type === 'FILE') {
        const fileExtension = entry.filename.slice(entry.filename.lastIndexOf(".")).toLowerCase();
        if (!excludedFileExtensions.includes(fileExtension) && !useFiles[`${path}${entry.filename}`]) {
          const option = document.createElement('option');
          option.value = `${path}${entry.filename}`;
          const displayPath = path.replace(/^\.\//, '') + entry.filename;
          const truncatedFilename = truncateFilename(displayPath, 20);
          option.text = truncatedFilename;
          dropdown.appendChild(option);
        }
      }
    }
  }
  await processDirectory(path);
  filterFiles()
}

function filterFiles(reset = false) {
  const searchInput = document.getElementById('file-search-input');
  if (reset) {
    searchInput.value = '';
  }
  const searchTerm = searchInput.value.toLowerCase();
  const dropdown = document.getElementById('file-dropdown');
  const options = dropdown.options;
  let matchFound = false;

  // Remove any existing "No matching files" option
  const noMatchOption = dropdown.querySelector('option[value="no-match"]');
  if (noMatchOption) {
    dropdown.removeChild(noMatchOption);
  }

  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    if (option.value === 'Choose file') continue; // Skip the default option
    const optionText = option.value.toLowerCase();
    if (searchTerm === '' || optionText.includes(searchTerm)) {
      option.style.display = '';
      matchFound = true;
    } else {
      option.style.display = 'none';
    }
  }

  // If no matches found, add a disabled "No matching files" option
  if (!matchFound && searchTerm !== '') {
    const noMatchOption = document.createElement('option');
    noMatchOption.textContent = 'No matching files';
    noMatchOption.value = 'no-match';
    noMatchOption.disabled = true;
    dropdown.appendChild(noMatchOption);
  }
}


function updateFileTabTitles() {
  const tabsContainer = document.querySelector('.files-tabs-container');
  const fileTabs = tabsContainer.querySelectorAll('.file-tab');
  const numFiles = fileTabs.length;

  if (numFiles > 0) {
    const maxFileTabs = Math.floor((maxContent / numFiles) - 1000);
    fileTabs.forEach(tab => {
      const filename = tab.id.replace('file-tab-', '');
      
      tab.title = `GPT-Replit has opened the file '${filename}'. 
The AI only will read the first '${maxFileTabs}' characters'`;
    });
  }
}

function addFileTab(filename, disableDelete = false) {
  const tabsContainer = document.querySelector('.files-tabs-container');
  const fileTab = document.createElement('div');
  fileTab.classList.add('file-tab');
  fileTab.id = `file-tab-${filename}`;
  fileTab.title = `GPT-replit has opened the file ${filename}`;
  fileTab.setAttribute('draggable', 'true');
  const displayName = filename.replace(/^\.\//, '');
  const truncatedFilename = truncateFilename(displayName, 20);
  fileTab.textContent = truncatedFilename;

  // Handle dragging
  if (!disableDelete) {
    fileTab.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', fileTab.id);
      document.getElementById('add-file-button').classList.add('trash');
      document.getElementById('add-file-button').innerHTML = '<i class="fas fa-trash-alt"></i>';
    });

    fileTab.addEventListener('dragend', (event) => {
      document.getElementById('add-file-button').classList.remove('trash');
      document.getElementById('add-file-button').innerHTML = '<i class="fa-solid fa-plus"></i>';
    });


  }

  const removeButton = document.createElement('button');
  removeButton.innerHTML = '&times;';
  removeButton.title = "Remove file.";
  removeButton.className = "remove-file-button";
  if (disableDelete) {
    removeButton.disabled = true;
  } else {
    removeButton.onclick = function () {
      fileTab.classList.add('delete-animation')
      setTimeout(() => tabsContainer.removeChild(fileTab), 500);
      useFiles[filename] = false;
      const dropdown = document.getElementById('file-dropdown');
      if (dropdown) {
        updateAvailableFiles(dropdown, "./");
      }
      updateFileTabTitles();
      filterFiles();
    };
  }

  useFiles[filename] = true;
  fileTab.appendChild(removeButton);
  tabsContainer.appendChild(fileTab);

  updateFileTabTitles();
}

document.getElementById('file-dropdown').addEventListener('change', function() {
    const selectedFile = this.value;
    if (selectedFile) {
      addFileTab(selectedFile);
      toggleOptions('file-input-options'); 
      const dropdown = document.getElementById('file-dropdown');
      if (dropdown) {
        updateAvailableFiles(dropdown, "./");
        filterFiles();
      }
    }
});

function toggleOptions(sectionId) {
  const sections = ['image-input-options', 'file-input-options'];
  sections.forEach(id => {
    const element = document.getElementById(id);
    if (id === sectionId) {
      element.style.display = element.style.display === 'none' ? 'block' : 'none'; // Simplify toggle
      if (element.style.display === 'block') {
        element.classList.add('show-options');
        element.classList.remove('hide-options');
        if (id === 'file-input-options') {
          filterFiles(true);
        }
      } else {
        element.classList.remove('show-options');
        element.classList.add('hide-options');
      }
    } else {
      // Ensure other sections are closed
      element.style.display = 'none';
      element.classList.remove('show-options');
      element.classList.add('hide-options');
    }
  });
}



document.getElementById('add-file-button').addEventListener('dragover', function(event) {
  event.preventDefault();
});

document.getElementById('add-file-button').addEventListener('drop', function(event) {
  event.preventDefault();

  const id = event.dataTransfer.getData('text/plain');
  const fileTab = document.getElementById(id);

  if (fileTab) {
    const filename = fileTab.id.replace('file-tab-', '');
    useFiles[filename] = false; 
    fileTab.parentNode.removeChild(fileTab);
    const dropdown = document.getElementById('file-dropdown');
    if (dropdown) {
      updateAvailableFiles(dropdown, "./");
    }
    updateFileTabTitles();
  }
});



document.getElementById('upload-image-button').addEventListener('click', () => toggleOptions('image-input-options'));
document.getElementById('add-file-button').addEventListener('click', () => toggleOptions('file-input-options'));

// If you want to programmatically close all fold-outs
function closeAllOptions() {
  ['image-input-options', 'file-input-options'].forEach(id => {
    const element = document.getElementById(id);
    element.classList.remove('show-options');
    element.style.display = 'none', 500; 
  });
  filterFiles(true);
}


let base64Image = null; 

async function compressToWebP(base64Data) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64Data;

        img.onload = () => {
            let quality = 0.8;
            const maxFileSize = 20 * 1024 * 1024; 

            const attemptCompression = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;

                // Draw the image onto the canvas
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Convert the canvas content to WebP format and get new base64 string
                const webpDataUrl = canvas.toDataURL('image/webp', quality);

                // Calculate the approximate file size of the result
                const fileSize = Math.round((webpDataUrl.length * 3 / 4));

                if (fileSize > maxFileSize && quality > 0.1) {
                    // Reduce quality and try again
                    quality -= 0.1;
                    attemptCompression();
                } else if (fileSize <= maxFileSize) {
                    // Satisfies file size condition
                    resolve(webpDataUrl);
                } else {
                    // If the file size is still too large and quality is too low, reject
                    reject('Unable to compress to desired file size');
                }
            };

            attemptCompression();
        };

        img.onerror = () => {
            reject('Failed to load image from base64 data. Please check the data and try again.');
        };
    });
}


async function useImageUrl() {
    const imageUrl = document.getElementById('image-url-input').value;
    if (!imageUrl) {
        alert("Please enter a URL");
        return;
    }

    const regex = /^(https?:\/\/)?([\w-]+(\.[\w-]+)+)([^#\s]*)?$/i;
    if (!imageUrl.match(regex)) {
        const UrlButton = document.getElementById("use-image-url-button")
        UrlButton.disabled = true
        UrlButton.innerText = "Invalid URL"
        setTimeout(function() {
            UrlButton.disabled = false
            UrlButton.innerText = "Use URL"
        }, 1500)
      return
    }

    try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();

        const base64data = await blobToBase64(blob);
        const compressedWebPBase64 = await compressToWebP(base64data);

        loadImagePreview(compressedWebPBase64)

        if (typeof toggleOptions === "function") {
            toggleOptions("image-input-options");
        }
        document.getElementById('image-url-input').value = '';
    } catch (error) {
        console.error("Failed to load or process image:", error);
        const UrlButton = document.getElementById("use-image-url-button")
          UrlButton.disabled = true
          UrlButton.innerText = "Failed loading image"
          setTimeout(function() {
              UrlButton.disabled = false
              UrlButton.innerText = "Use URL"
          }, 2500)
        return
    }
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function loadImagePreview(base64Src) {
  const uploadButton = document.getElementById('upload-image-button');
  const imagePreviewContainer = document.getElementById('image-preview-container');
  const deleteImageButton = document.getElementById('delete-image');
  const imgPreview = document.getElementById('image-preview');
    uploadButton.style.display = 'block';
    imagePreviewContainer.style.display = 'block';
    deleteImageButton.style.display = 'block';
    
    imgPreview.src = base64Src;
    document.getElementById('image-preview-container').style.display = 'block'; 
    base64Image = base64Src; 
}


document.getElementById('delete-image').addEventListener('click', function() {
  const container = document.getElementById('image-preview-container');
  container.style.display = 'none';
  base64Image = null
  document.getElementById('image-preview').src = '';
});

document.getElementById('image-file-input').addEventListener('change', async function(event) {
  const file = event.target.files[0];
  if (!file) {
    console.log("No file chosen");
    return
  }
  try {
    const base64String = await blobToBase64(file)
    const compressedWebPBase64 = await compressToWebP(base64String)
    loadImagePreview(compressedWebPBase64)
    toggleOptions("image-input-options")
  } catch (error) {
    const UrlButton = document.getElementById("use-image-url-button")
      UrlButton.disabled = true
      UrlButton.innerText = "Failed loading image"
      setTimeout(function() {
          UrlButton.disabled = false
          UrlButton.innerText = "Use URL"
      }, 2500)
    return
    
  }
});

function scrollToBottom() {
  const chatMessages = document.getElementById('chat-messages');
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

document.getElementById('scroll-to-bottom-button').addEventListener('click', scrollToBottom);

function loadPreviousMode() {
  const previousMode = localStorage.getItem('selectedMode');
  if (previousMode) {
    modeSelector.value = previousMode;
  }
  updateInputMaxLength();
}

// Save settings to localStorage
function saveSettings(settings) {
  localStorage.setItem('settings', JSON.stringify(settings));
}

function loadSettings() {
  const settings = localStorage.getItem('settings');
  const parsedSettings = settings ? JSON.parse(settings) : null;
  if (parsedSettings && !parsedSettings.used) {
    return {};
  }
  return parsedSettings;
}

function loadRawSettings() {
  const settings = localStorage.getItem('settings');
  return settings ? JSON.parse(settings) : null;
}

const modal = document.getElementById('settings-modal');
const span = document.getElementById('close-modal');

window.onclick = function(event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
}

span.onclick = function() {
  modal.style.display = "none";
}

document.getElementById('reset-settings-button').addEventListener('click', async () => {
  // Show confirm dialog
  if (confirm('Are you sure you want to reset the settings to their default values?')) {
    // Clear settings from local storage
    localStorage.removeItem('settings');

    // Reset inputs to default values
    document.getElementById('temperature').value = '0.7';
    document.getElementById('model').value = 'gpt-3.5-turbo';
    document.getElementById('copy-button').checked = false;
    document.getElementById('noyap-btn').checked = false;
    document.getElementById('custom-server').value = 'api.openai.com';

    if (lastID.reset) {
      await replit.messages.hideMessage(lastID.reset)
    }
    lastID.reset = await replit.messages.showError("Reset settings to default", 5500)
  }
});

document.getElementById('settings-btn').addEventListener('click', async () => {
  const settings = loadRawSettings();
  if (settings) {
    document.getElementById('use').checked = settings.hasOwnProperty('used') ? settings.used : false;
    document.getElementById('temperature').value = settings.temp || '0.7';
    document.getElementById('custom-server').value = settings.server || 'api.openai.com';
    document.getElementById('model').value = settings.model || 'gpt-3.5-turbo';
    document.getElementById('copy-button').checked = settings.hasOwnProperty('copyButton') ? settings.copyButton : true;
    document.getElementById('noyap-btn').checked = settings.hasOwnProperty('noyap') ? settings.noyap : true;


  }
  document.getElementById('settings-modal').style.display = 'block';
});

document.getElementById('save-settings-button').addEventListener('click', async () => {
  const settings = {
    used: document.getElementById('use').checked,
    temp: document.getElementById('temperature').value,
    model: document.getElementById('model').value,
    copyButton: document.getElementById('copy-button').checked,
    noyap: document.getElementById('noyap-btn').checked,
    server: document.getElementById('custom-server').value,
  };
  saveSettings(settings)

  if (lastID.save) {
    await replit.messages.hideMessage(lastID.save)
  }
  lastID.save = await replit.messages.showNotice("Saved custom settings", 1500)
  modal.style.display = "none";
  await customModelUpdate();
});

function lazyLoadImages() {
  const lazyImages = document.querySelectorAll('img.lazy');
  lazyImages.forEach(img => {
    if (img.getBoundingClientRect().top < window.innerHeight) {
      img.src = img.dataset.src;
      img.onload = () => {
        img.classList.add('loaded');
      };
    }
  });
}

document.addEventListener('scroll', lazyLoadImages);


async function customModelUpdate() {
  const settings = loadSettings();
  const modelSelect = document.getElementById('mode');

  // Find the disabled option
  const disabledOption = Array.from(modelSelect.options).find(option => option.value === 'disabled');

  if (settings && settings.used) {
    if (!lastID.customModalWarning) {
      lastID.customModalWarning = await replit.messages.showNotice("Watch out, your now using a custom model. We have no character limit as we do not know the limit for custom models. It might error because you used more tokens that it can handle!", 8500)
    }
    if (!disabledOption) {
      const newDisabledOption = document.createElement('option');
      newDisabledOption.textContent = 'Disabled';
      newDisabledOption.value = 'disabled';
      modelSelect.appendChild(newDisabledOption);
    }
    modelSelect.value = 'disabled';  // Select the disabled option
    modelSelect.disabled = true;
    modelSelect.title = 'You are using custom variables'

  } else {
    // Remove the disabled option if it exists
    if (disabledOption) {
      modelSelect.removeChild(disabledOption);
    }
    modelSelect.title = 'select which GPT model you want to use.'
    modelSelect.disabled = false;
  }
}

setInterval(async function() {
  await customModelUpdate()
  const dropdown = document.getElementById('file-dropdown');
  if (dropdown) {
    updateAvailableFiles(dropdown, "./");
  }
}, 60000);

window.onload = function() {
  customModelUpdate()
  loadPreviousMode()
  lazyLoadImages()
}

const modeSelector = document.getElementById("mode");
modeSelector.addEventListener("change", updateInputMaxLength);