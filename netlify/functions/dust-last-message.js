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
