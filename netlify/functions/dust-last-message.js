exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        message: 'Dust Messages function is working!',
        note: 'Optimized for 10-second timeout'
      })
    };
  }

  if (event.httpMethod === 'POST') {
    try {
      const { conversationId, workspaceId, apiKey } = JSON.parse(event.body || '{}');
      
      if (!conversationId || !workspaceId || !apiKey) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing required fields' })
        };
      }

      const response = await fetch(
        `https://dust.tt/api/v1/w/${workspaceId}/assistant/conversations/${conversationId}/events`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'text/event-stream'
          }
        }
      );

      if (!response.ok) {
        return {
          statusCode: response.status,
          headers,
          body: JSON.stringify({ error: `Dust API error: ${response.status}` })
        };
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let userMessages = [];
      let assistantMessages = [];
      let lastAssistantMessage = null;
      
      // Set a timeout to prevent function timeout
      const timeout = setTimeout(() => {
        reader.cancel();
      }, 8000); // 8 seconds to leave buffer for response

      try {
        // Read stream with timeout protection
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const eventData = JSON.parse(line.slice(6));
                
                if (eventData.type === 'user_message_new') {
                  userMessages.push({
                    messageId: eventData.messageId,
                    content: eventData.message.content,
                    timestamp: eventData.created
                  });
                }
                
                if (eventData.type === 'agent_message_success') {
                  const assistantMsg = {
                    messageId: eventData.messageId,
                    content: eventData.message.content,
                    timestamp: eventData.created
                  };
                  assistantMessages.push(assistantMsg);
                  lastAssistantMessage = assistantMsg; // Keep updating
                }
                
              } catch (parseError) {
                // Skip invalid JSON
              }
            }
          }
        }
      } catch (streamError) {
        // Stream was cancelled or errored, but we might have partial data
        console.log('Stream ended early:', streamError.message);
      } finally {
        clearTimeout(timeout);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          conversationId,
          note: 'May be partial data due to timeout limits',
          data: {
            userMessages,
            assistantMessages,
            lastAssistantMessage,
            totalUserMessages: userMessages.length,
            totalAssistantMessages: assistantMessages.length
          }
        })
      };

    } catch (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};
