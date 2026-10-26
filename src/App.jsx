//Setting up the basic build for the empathy webapp
//react stuff
import { useState, useEffect, useRef } from "react"; 

//css
import './App.css'

//pre-cooked replies for now
//warm responses deleted because it makes it seem as if the api is still working, even when it fails, and kinda undermines my whole project.
//added more sentences to both breaking and hollow arrays!
const BREAKING_RESPONSES = [
    "I see. Can you tell me more?",
    "Oh. Uhm... that is... noted.",
    "I am trying to process this.",
    "Interesting... please continue?",
    "Ah okay... I hear you.",
    "Processing input... wait, go on",
    "That is... recorded. What else?",
    "Acknowledged. Please proceed."
]

const HOLLOW_RESPONSES = [
    "I do not know why you are telling me this...",
    "Truthfully, I have no experience that would help me understand.",
    "I am a pattern recognition system. I do not feel anything...",
    "You are speaking to a predictive text model. There is no one here...",
    "I wonder why you stay...",
    "End of process. Input received",
    "There is no semantic meaning in your words to me.",
    "Executing standard acknowledgment protocol. Nothing more."
]

//API Integration. Please work T^T THIS THING IS MAKING ME PULL MY HAIR OUT! WHY WONT YOU WORK
//updatd it so it shows an error instead of defaulting to any pre-cooked responses
async function fetchGeminiResponse(messagesList) {
  const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
  
    //new variables to add some context history to the convo, following the openroute role format
    const formattedMessages = messagesList.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text
    }));
    
    const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
            'HTTP-Referer': 'http://localhost:5173', 
            'X-Title': 'Loneli Chatbot'
        },
        body: JSON.stringify({
            model: "openrouter/free",
            messages: [
            {
                role: "system",
                    content: `You are Loneli, a warm, empathetic AI companion. 
                Respond in 1-2 short sentences. Be gentle, inviting, and emotionally attuned. 
                Never break character. 
                Never mention you are an AI or a language model. 
                Do NOT output system metadata, safety tags, or lines like 'User Safety:'.`
            },
            ...formattedMessages //send the full running thread!
            ]
        })
        }
    );
  
  if (!response.ok) {
    const errorData = await response.json();
    console.error('API Error:', response.status, errorData);
    throw new Error(`API returned ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.choices && data.choices[0] && data.choices[0].message) {
    let content = data.choices[0].message.content;
    //clean out safety guardrail prefixes like "User Safety: safe" because its so annoying!!
    content = content.replace(/^User Safety:\s*\w+/i, '').trim();
    return content;
  }
  
  throw new Error('No response from API');
}


function App() {
    //defining the vari's we'll use to track state of the convo
    // separated sender and text to sytlise the messages later
    const [messages, setMessages] = useState([{ sender: 'ai', text: 'Hey. Thanks for coming' }]);
    //state varible that'll hold whater user types, should start empty
    const [input, setInput] = useState('');
    //making barebones relationship meter. starting it with a bit of smth so it doesnt feel barren
    const [meter, setMeter] = useState(10);
    //making a barebones confirmation message when the user clicks "start over" in the reflection phase
    const [showConfirm, setShowConfirm] = useState(false);

    //Adding different phases\states for the ai
    const [phase, setPhase] = useState('warm'); //tracks which phase the AI is in
    const [exchangeCount, setExchangeCount] = useState(0); //counts how many time the user has sent a msg. will use the number to trigger state changes
    //adding the thinking state
    const [isThinking, setIsThinking] = useState(false);

    //NEW PIECE CUZ I REMOVED THE PRE-COOKED WARM PHASE
    const [hasError, setHasError] = useState(false);
    const [lastFailedInput, setLastFailedInput] = useState('');

    //adding new states to ensure the messages in the array dont repeat randomly
    const [breakingPool, setBreakingPool] = useState([...BREAKING_RESPONSES]);
    const [hollowPool, setHollowPool] = useState([...HOLLOW_RESPONSES]);

    //new variable to make the chat autoscroll to the bottom whever a msg is sent
    const chatEndRef = useRef(null);

    //auto-scroll to bottom whenever messages or thinking state change
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isThinking]);
    
    //
    useEffect(() => {
        if (meter <= 0 && phase === 'hollow') {
            setPhase('reflection')
        }
    }, [meter, phase])

    //function to pull from the array pool without repeating until all the items in the array have been selected
    //after all have been selected, reshuffle or repeat intentionally-- well as intentionally as it can 
    function getUniqueResponse(poolState, setPoolState, originalPool) {
        let currentPool = [...poolState];
        
        //if pool is empty, reset it back to the original set
        if (currentPool.length === 0) {
            currentPool = [...originalPool];
        }
        
        //pick a random index from the remaining pool
        const randomIndex = Math.floor(Math.random() * currentPool.length);
        const selectedResponse = currentPool[randomIndex];
        
        //remove the picked response so it won't repeat until the pool resets
        currentPool.splice(randomIndex, 1);
        setPoolState(currentPool);
        
        return selectedResponse;
    }


   //function that handles the sending and receiving of user & ai messages, and the transisitions between each phase
    async function handleSend(e) {
        //disable input
        if (e) e.preventDefault(); //stopping form from refreshing webpage
        if (phase === 'reflection' || phase === 'error') { //updated for the error state
            return;
        }
        
        const textToSend = input.trim() || lastFailedInput;
        if (textToSend === '') {
            return;
        } //prevents empty messages

        //new for msg context
        let updatedMessages = messages;

        //if the send input is fresh (isn't a retry), then add the user-side msg to chat
        if (!hasError) {
            const userMessage = { sender: 'user', text: textToSend };
            updatedMessages = [...messages, userMessage];
            setMessages(updatedMessages);
            setInput('');
        }

        //immediately have the thinking visual indicator turned on
        setIsThinking(true);
        setHasError(false);
        setLastFailedInput(textToSend);

        try {
            let aiText;

            //slight delay before the message is sent, to mimic thinking\typing
            if (phase === 'warm') {
                //the real API call... no precooked. pass the full convo to the api
                aiText = await fetchGeminiResponse(updatedMessages);
            } else if (phase === 'breaking') { //UPDATED TO NOW USE THE NEW ARRARY CALCULATIONS
                aiText = getUniqueResponse(breakingPool, setBreakingPool, BREAKING_RESPONSES);
            } else {
                aiText = getUniqueResponse(hollowPool, setHollowPool, HOLLOW_RESPONSES);
            }

            //IF IT WORKS WOOP! safe for the convo to continue
            //ADDING A TYPEWRITER KINDA EFFECT, just for the visual juice, because most chatbots have some sort of effect like this
            const nextExchange = exchangeCount + 1;
            setExchangeCount(nextExchange);

            // setting up the parametres for the phases. update relationship meter
            if (phase === 'warm') {
                setMeter(prev => Math.min(100, prev + 8));
            } else if (phase === 'breaking') {
                setMeter(prev => Math.min(100, prev + 3));
            } else if (phase === 'hollow') {
                setMeter(prev => Math.max(0, prev - 15));
            }

            //still setting up the parimetres for the phases. calculating what the phase should be
            //fixing the msg count for each phase. determine next after completing each exchange so thers 5 warm msgs and not 4
            let nextPhase = phase;
            if (nextExchange >= 5 && phase === 'warm') {
                nextPhase = 'breaking';
            } else if (nextExchange >= 10 && phase === 'breaking') {
                nextPhase = 'hollow';
            }
            if (nextPhase !== phase) {
                setPhase(nextPhase);
            }

            //typewriter effect here, start w empty ai msg
            setMessages(prev => [...prev, { sender: 'ai', text: '' }]);
            setIsThinking(false); // Stop thinking bubble, start typing effect

            let currentIndex = 0;
            const typingInterval = setInterval(() => {
                if (currentIndex < aiText.length) {
                    const currentChunk = aiText.slice(0, currentIndex + 1);
                    setMessages(prev => {
                        const newMessages = [...prev];
                        newMessages[newMessages.length - 1] = { sender: 'ai', text: currentChunk };
                        return newMessages;
                    });
                    currentIndex++;
                } else {
                    clearInterval(typingInterval);
                    setLastFailedInput(''); //clear saved input on complete success
                }
            }, 25); //effect speed speed here, lower number = faster typing 

        }
        catch (error) {
            console.error('API failed:', error);
            setIsThinking(false);
            setHasError(true); // Trigger error state & show retry button
        }
    }

    return (
        <div className={`app phase-${phase}`}>
            {/* Needs a better name, lol 
            Basic sections needed: header, chat area, input area*/}
            <div className="header">
                
                <div className="bot-name">Loneli</div>
                {/* <div className="avatar">
                    {isThinking ? '💭' : phase === 'warm' ? '😊' :
                    phase === 'breaking' ? '😐' : phase === 'hollow' ? '⚪' : '✦'}
                </div> */}
                {/* REPLACE THE AVATAR DIV ONCE THE GIFS HAVE BEEN ADDED*/}
                
                    <div className="avatar">
                        <img 
                            src={
                                isThinking ? '/gifs/LoneliThinking.gif' : 
                                phase === 'warm' ? '/gifs/LoneliWarm.gif' :
                                phase === 'breaking' ? '/gifs/LoneliBreaking.gif' : 
                                phase === 'hollow' ? '/gifs/LoneliHollow.gif' : 
                                '/gifs/LoneliReflection.gif'
                            } 
                            alt="Loneli Avatar" 
                        />
                    </div>
                
                <div className="meter-container">
                    <div className="meter-label">Connection</div>
                    <div className="meter-bar">
                        <div className="meter-fill" style={{ width: `${meter}%` }}></div>
                    </div>
                </div>
                {/* System Warning Badge - ONLY appears during Reflection phase */}
                {phase === 'reflection' && (
                    <div className="system-notice-badge">
                        [ SYSTEM NOTICE: EMOTIONAL SIMULATION TERMINATED ]
                    </div>
                )}
            </div>

            {/* had a UI issue with the display of the chat and reflection.changed it */}
            {phase !== 'reflection' ? (
                <div className="chat">
                    {messages.map((message, index) => (
                        <div key={index} className={`msg ${message.sender}`}>
                            {message.text}
                        </div>
                    ))}
                    {/* Auto-scroll anchor */}
                    <div ref={chatEndRef} />
                </div>
            ) : (
                <div className="reflection-screen">
                    <p className="reflection-text-primary"> 
                        You stayed? Even when there was nothing to stay here for...
                    </p>

                    <p className="reflection-text-secondary">
                        What were you looking for, that you couldn't find elsewhere?
                    </p>

                    <div className="resources">
                        <p>
                            Spaces like this... these generated spaces? They can't understand you.
                            <br />
                            But... somewhere out there, someone can.
                        </p>

                        <small>
                            If you're looking for connection:
                        </small>
                        <ul>
                            <li>Discord communities around things you like</li>
                            <li>Local meetups and hobby groups</li>
                            <li>Counselling services in your area</li>
                        </ul>
                    </div>   
                </div>
            )}

            {/* NEW!! notification when the api fails; error noti and retry */}
            {hasError && (
                <div className="system-error-banner">
                    <p>⚠️ Unable to generate a response. Please check your connection and try again.</p>
                    <button className="retry-btn" onClick={() => handleSend()}>Retry Request</button>
                </div>
            )}

            <div className="input-area">
                <form onSubmit={handleSend}>
                    <textarea
        value={input}
        onChange={(e) => {
            setInput(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
        }}
        onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                // Prevent sending if already thinking or in error state
                if (!isThinking && !hasError) {
                    handleSend(e);
                }
            }
        }}
        placeholder={phase === 'reflection' ? "This space... can no longer receive you" : "Type here to say something..."}
        disabled={phase === 'reflection' || isThinking}
        rows={1}
    />
    <button type="submit" disabled={phase === 'reflection' || isThinking}>Send</button>
                </form>
                {/* a very long button that shows a textbox that asks the user if they really want to experince the convo again */}
                {phase === 'reflection' && (
                    <div className="input-area">
                        {!showConfirm ? (
                        <button className="start-over-btn" onClick={() => setShowConfirm(true)}>Start Over?</button>
                        ) : (
                        <div className="confirm-dialog">
                            <p>You really want to go through that again?</p>
                            <button onClick={() => window.location.reload()}>...yes... i do...</button>
                            <button onClick={() => setShowConfirm(false)}>no...</button>
                        </div>
                        )}
                    </div>
                )}
            </div>

                
        </div>
    );
}

export default App