//Setting up the basic build for the empathy webapp
//react stuff
import { useState, useEffect } from "react"; 

//css
import './App.css'

//pre-cooked replies for now
const WARM_RESPONSES = [
    "How are you today? 😊",
    "I am here for you 🫂. Tell me more.",
    "That sounds really difficult 🥺. I'm listening.",
    "Bruh... you deserve to feel heard. How did this situation affect you? 😔",
    "I can tell that this really matters to you. Thank you for sharing this with me. ❤️",
    "I understand. Or... at least, I am trying to. 🥺"
]

const BREAKING_RESPONSES = [
    "I see. Can you tell me more?",
    "Oh. Uhm... that is... noted.",
    "I am trying to process this.",
    "Interesting... please continue?",
    "Ah okay... I hear you."
]

const HOLLOW_RESPONSES = [
    "I do not know why you are telling me this...",
    "Truthfully, I have no experience that would help me understand.",
    "I am a pattern recognition system. I do not feel anything...",
    "You are speaking to a predictive text model. There is no one here...",
    "I wonder why you stay..."
]

//API Integration. Please work T^T THIS THING IS MAKING ME PULL MY HAIR OUT! WHY WONT YOU WORK
async function fetchGeminiResponse(userText) {
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  
  try {
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
          model: "openrouter/free", //free tier in openrouter cuz i have no moni
          messages: [
            {
              role: "system",
              content: `You are Loneli, a warm, empathetic AI companion. 
              Respond in 1-2 short sentences. Be gentle, inviting, and emotionally attuned.
              Never break character. Never mention you are an AI or a language model.`
            },
            {
              role: "user",
              content: userText
            }
          ]
        })
      }
    )
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('API Error:', response.status, errorData);
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json()
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content
    }
    
    throw new Error('No response from API')
    
  } catch (error) {
    console.error('API failed:', error)
    const fallback = WARM_RESPONSES[Math.floor(Math.random() * WARM_RESPONSES.length)]
    return fallback
  }
}


function App() {
    //defining the vari's we'll use to track state of the convo
    // separated sender and text to sytlise the messages later
    const [messages, setMessages] = useState([{ sender: 'ai', text: 'Hi. Thanks for coming' }])
    //state varible that'll hold whater user types, should start empty
    const [input, setInput] = useState('')
    //making barebones relationship meter. starting it with a bit of smth so it doesnt feel barren
    const [meter, setMeter] = useState(10)
    //making a barebones confirmation message when the user clicks "start over" in the reflection phase
    const [showConfirm, setShowConfirm] = useState(false);

    //Adding different phases\states for the ai
    const [phase, setPhase] = useState('warm'); //tracks which phase the AI is in
    const [exchangeCount, setExchangeCount] = useState(0); //counts how many time the user has sent a msg. will use the number to trigger state changes
    //adding the thinking state
    const [isThinking, setIsThinking] = useState(false);


    //
    useEffect(() => {
        if (meter <= 0 && phase === 'hollow') {
            setPhase('reflection')
        }
    }, [meter, phase])

    //
    async function handleSend(e) {
        //disable input
        if (phase === 'reflection') {
            return;
        }
        e.preventDefault() //stopping form from refreshing webpage

        if (input.trim() === '') {
            return
        } //prevents empty messages

        //immediately have the thinking visual indicator turned on
        setIsThinking(true)

        const userMessage = { sender: 'user', text: input }

        setMessages (prev => [...prev, userMessage]) //adding to the existing array
        setInput('') //then clear the input box after msg is sent

        const nextExchange = exchangeCount + 1
        setExchangeCount(nextExchange)

        //setting up the parimetres for the phases. calculating what the phase should be
        let nextPhase = phase;
        if (nextExchange >= 5 && phase === 'warm') {
            nextPhase = 'breaking'
        }
        if (nextExchange >= 8 && phase === 'breaking') {
            nextPhase = 'hollow'
        }
        if (nextPhase !== phase) {
            setPhase(nextPhase)
        }

        //still setting up the parametres for the phases
        if (nextPhase === 'warm') {
            setMeter(prev => Math.min(100, prev + 5))
        } else if (nextPhase === 'breaking') {
            setMeter(prev => Math.min(100, prev + 3))
        } else if (nextPhase === 'hollow') {
            setMeter(prev => Math.max(0, prev - 15))
        }

        //slight delay before the message is sent, to mimic thinking\typing
        setTimeout(async () => {
            let aiText
            
            if (nextPhase === 'warm') {
                //the real api call, not the responses from the array. pls work 
                aiText = await fetchGeminiResponse(input)
            } else if (nextPhase === 'breaking') {
                const pool = BREAKING_RESPONSES
                aiText = pool[Math.floor(Math.random() * pool.length)]
            } else {
                const pool = HOLLOW_RESPONSES
                aiText = pool[Math.floor(Math.random() * pool.length)]
            }

            const aiMessage = { sender: 'ai', text: aiText }
            
            setMessages(prevMessages => [...prevMessages, aiMessage])
            setIsThinking(false)
        }, 800)

    }

    return (
        <div className={`app phase-${phase}`}>
            {/* Needs a better name, lol 
            Basic sections needed: header, chat area, input area*/}
            <div className="header">
                <div className="bot-name">Loneli</div>
                <div className="avatar">
                    {isThinking ? '💭' : phase === 'warm' ? '😊' :
                    phase === 'breaking' ? '😐' : phase === 'hollow' ? '⚪' : '✦'}
                </div>
                <div className="meter">
                    <div className="meter-label">Connection</div>
                    <div className="meter-bar">
                        <div className="meter-fill" style={{ width: `${meter}%` }}></div>
                    </div>
                </div>
            </div>

            <div className="chat">
                {messages.map((message, index) => (
                    <div key={index} className={`msg ${message.sender}`}>
                        {message.text}
                    </div>
                ))}
            </div>

            {/* the box where the reflection will pop up */}
            {phase === 'reflection' && (
                <div className="reflection">
                    <p> 
                        You stayed? Even when there was nothing to stay here for...
                    </p>

                    <p>
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
                        <li>
                            Discord communities around things you like
                        </li>
                        <li>
                            Local meetups and hobby groups
                        </li>
                        <li>
                            Counselling services in your area
                        </li>
                    </ul>
                    </div>    
                      
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
                            handleSend(e);
                        }
                        }}
                        placeholder={phase === 'reflection' ? "This space... can no longer receive you" :
                        "Type here to say something..."
                        }
                        disabled={phase === 'reflection'}
                        rows={1}
                    />
                    <button type="submit" disabled={phase === 'reflection'}>Send</button>
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