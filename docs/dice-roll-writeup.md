# Making the d20 roll feel real

A short, plain-English explanation of what we changed and why it now looks like a real die instead of a spinning sticker.

## What was wrong

The on-screen d20 was actually built correctly as a real 3D shape — twenty little triangles arranged into a proper 20-sided die. But three things made it feel fake:

First, a single line of styling was quietly flattening it. Think of a paper model of a die: if you press it under a heavy book, all the faces squash into one flat sheet. A stray visual setting was doing exactly that to our die, so instead of a chunky solid it became a flat shape — and a flat shape spinning end-over-end looks like a coin flipping, not a die tumbling.

Second, the number you saw wasn't really on the die. It was a separate number floating in front of the shape, like a price tag stuck on top. The die spun behind it, but the two were never connected, so it never felt like the die "landed" on anything.

Third, the spin never slowed down. A real die thrown on a table loses energy — it tumbles fast, then slower, wobbles, and settles. Ours spun at one constant speed and then just stopped dead, which is what made it feel weightless and floaty.

## What we changed

We fixed all three so the roll behaves the way your eye expects.

We stopped the die from being flattened, so it's a genuine solid object again — you can see its real corners and faces catch the light as it turns.

We made the die actually land on the rolled number. Now when the game rolls, say, a 14, the die rotates so that the real "14" face turns to point right at you, sitting upright and readable — and that face gets a warm gold highlight so it's easy to spot. The number you read is literally the side facing you, exactly like a real die on a table. No more floating tag.

We gave the roll some weight. The die now starts with a fast, lively tumble and gradually slows down, with a tiny overshoot-and-settle at the end — the little "thunk" of a die rocking into place. That deceleration is the single biggest reason it suddenly feels physical instead of cartoonish.

We also timed the tumble to finish right as the die "arrives" where it's flying to on screen, so the spinning stops at the moment it lands rather than carrying on in mid-air.

## The fun part: critical hits

When you roll a natural 20 — the best possible result — the screen now throws up a big celebratory "HOLY SHIT" in bold white letters with a heavy black outline, popping in with a little bounce. It's an instant, unmistakable signal that something great just happened.

## The short version

The die used to be a flat picture spinning forever with a number stuck on front. Now it's a solid object that tumbles, slows down under its own "weight," and comes to rest showing the face it actually rolled — with a loud celebration when you hit a 20.
