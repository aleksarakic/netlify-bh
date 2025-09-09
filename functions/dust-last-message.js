exports.handler = async (event, context) => {
  const { conversationId, workspaceId, apiKey } = JSON.parse(event.body);
  
  try {
    const response = await fetch(
      `https://dust.tt/api/v1/w/${workspaceId}/assistant/conversations/${conversationId}/events`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'text/event-stream'
        }
      }
    );

    const reader = response.body.getReader();
    let lastMessage = null;
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += new TextDecoder().decode(value);
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'agent_message_success') {
              lastMessage = {
                content: data.message.content,
                messageId: data.messageId,
                timestamp: data.created
              };
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(lastMessage || { error: 'No message found' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};