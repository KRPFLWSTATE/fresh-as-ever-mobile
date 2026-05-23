#import <React/RCTBridgeModule.h>

@interface FreshAsEverEnvironment : NSObject <RCTBridgeModule>
@end

@implementation FreshAsEverEnvironment

RCT_EXPORT_MODULE(FreshAsEverEnvironment);

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (NSDictionary *)constantsToExport
{
#if TARGET_OS_SIMULATOR
  return @{@"isSimulator" : @YES};
#else
  return @{@"isSimulator" : @NO};
#endif
}

@end
