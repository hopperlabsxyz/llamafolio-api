import aws from "aws-sdk";

export function invokeLambda(functioName: string, event: any) {
  return new Promise((resolve, _reject) => {
    new aws.Lambda().invoke(
      {
        FunctionName: functioName,
        InvocationType: "Event",
        Payload: JSON.stringify(event, null, 2), // pass params
      },
      function (error, data) {
        console.log(error, data);
        resolve(data);
      }
    );
  });
}

export function wrapScheduledLambda(
  lambdaFunc: (event: any, context: AWSLambda.Context) => Promise<any>
): (
  event: void,
  context?: any,
  callback?: any
) => Promise<void | undefined> | void {
  if (process.env.stage !== "prod") {
    return () => {
      console.log("This lambda is getting ignored, stage is not prod");
    };
  }
  return lambdaFunc;
}