import { getGoogleSearchUrl, logger, parseMessageContent } from '@krobert/utils';

import { AgentState, model } from '../global';

export const informationGatheringNode = async (state: typeof AgentState.State) => {
  const { city, icao } = state;

  const prompt = `
    Today is ${new Date().toISOString()}
    I need you to fetch last **metar and taf** data for ICAO code: ${icao}.
    
    Then walk through websites below to gather infomations:

    - https://www.wunderground.com/hourly/cn/${city.toLowerCase()}/${icao}
    - https://www.wunderground.com/history/daily/cn/${city.toLowerCase()}/${icao}
    - ${getGoogleSearchUrl([`2026年 ${city} 台风`])}

    Finally use a simple format to output what you have gathered like this:
    """
    ## Metar Report:
    xxxx (Including raw datagram and parsed structured data)

    ## Taf Forecast:
    xxxx (Including raw datagram and parsed structured data)

    ## Wunderground Hourly Report:
    xxxx (Output complete data, don't sample)

    ## Wunderground Daily History Report:
    xxxx (Output complete data, don't sample)

    ## XXX Report (Other information sources)
    xxxx
    """

    Remember: Make the output concise and easy to read, so you should include those data number in a structured format.
    
    PS: You need to use the tools to fetch the data, don't use your internal knowledge.
    PS2: Use celsius as the unit of temperature.
  `;
  const result = await model.invoke([...state.messages, ['user', prompt]]);

  const { additional_kwargs, tool_calls, usage_metadata } = result;

  logger.info('[WeatherAgent] result from informationGathering', {
    additional_kwargs,
    tool_calls,
    usage_metadata,
  });

  return { messages: [result], rawBrowserData: parseMessageContent(result.content) };
};
