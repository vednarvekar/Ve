"""Builds training data for the SP1 router spike.

Each task gets hand-written phrasings with slots. Phrasings are written
independently of the test set in docs/4 so the test stays fair. The OUT label
means "not a V1 task".
"""
import json
import random

random.seed(7)

SLOTS = {
    "person": ["Rahul", "Priya", "Ved", "Anita", "Sam", "my manager", "mom", "Neha", "Karan", "Dev"],
    "app": ["Spotify", "Chrome", "Excel", "Notepad", "Word", "Teams", "Outlook", "Calculator", "WhatsApp", "VS Code"],
    "site": ["Amazon", "Netflix", "GitHub", "LinkedIn", "Wikipedia", "Flipkart", "Reddit"],
    "song": ["Shape of You", "Kesariya", "some jazz", "Coldplay", "A R Rahman", "lo-fi beats", "my workout mix"],
    "creator": ["MKBHD", "Veritasium", "Mark Rober", "Fireship", "Kurzgesagt"],
    "topic": ["the budget", "the offer letter", "the audit", "vendor payments", "the launch", "travel plans"],
    "file": ["the invoice", "the Q3 deck", "the contract", "my resume", "the sales sheet", "the proposal", "the photos"],
    "folder": ["Invoices", "Finance", "Projects", "Receipts", "Taxes", "Backup"],
    "day": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "tomorrow", "next week"],
    "time": ["9am", "11:30", "2pm", "4 pm", "6 in the evening", "noon", "5:15pm"],
    "dur": ["15 minutes", "30 minutes", "an hour", "two hours", "45 min"],
    "place": ["Tokyo", "London", "Dubai", "Sydney", "Paris", "Berlin"],
    "thing": ["pasta recipes", "cheap flights", "laptop deals", "python tutorials", "best phones", "yoga videos"],
    "msg": ["I'll be late", "the meeting is cancelled", "running 10 mins behind", "call me when free", "thanks a lot", "reached home"],
    "num": ["340", "1500", "75", "2,800", "12", "900"],
}

T = {
    "A1": ["open {app}", "launch {app}", "start {app} for me", "close {app}", "quit {app}", "can you open up {app}", "fire up {app}", "shut down {app}"],
    "A2": ["play {song}", "put on {song} on spotify", "i want to hear {song}", "spotify play {song}", "queue up {song}", "play some {song} please"],
    "A3": ["pause the music", "next song", "skip this track", "resume playback", "make it louder", "volume to 40", "previous track", "stop the music"],
    "A4": ["open the latest video from {creator}", "show me {creator}'s newest upload", "what did {creator} post recently on youtube", "play {creator}'s new video"],
    "A5": ["search youtube for {thing}", "google {thing}", "look up {thing} on the web", "find {thing} on youtube", "search for {thing}"],
    "A6": ["open {site}", "go to {site}", "take me to {site}.com", "pull up the {site} website", "browse to {site}"],
    "M1": ["message {person} on whatsapp: {msg}", "whatsapp {person} that {msg}", "text {person} on whatsapp saying {msg}", "send {person} a whatsapp, {msg}", "let {person} know on whatsapp {msg}"],
    "M2": ["send {file} to {person} on whatsapp", "whatsapp {file} to {person}", "share {file} with {person} over whatsapp", "forward {file} to {person} via whatsapp"],
    "M3": ["any new whatsapp messages", "read my whatsapp", "who messaged me on whatsapp", "check whatsapp for unread chats", "what did {person} say on whatsapp"],
    "M4": ["post in the teams channel: {msg}", "tell the team on teams {msg}", "write {msg} in the teams chat", "send {msg} to my teams group", "teams message to {person}: {msg}"],
    "E1": ["any urgent emails", "show important unread mail", "what emails need attention", "check my inbox for urgent stuff", "anything critical in my email"],
    "E2": ["summarize {person}'s last email", "give me the gist of this email thread", "tldr the email from {person}", "what does the email about {topic} say", "sum up this mail chain"],
    "E3": ["find emails from {person} about {topic}", "search my mail for {topic}", "emails from {person} last month", "look for messages about {topic} from {day}", "show me mail from {person}"],
    "E4": ["which emails still need my reply", "who am i yet to respond to", "unanswered mail", "show emails waiting on me", "what mail have i ignored"],
    "E5": ["draft a reply to {person} saying {msg}", "write a response to this email: {msg}", "prepare a reply for {person}'s email", "compose a reply that says {msg}"],
    "E6": ["archive all newsletters", "mark all promotional emails as read", "move {person}'s emails to the {folder} folder", "clear out old newsletters", "mark my inbox as read"],
    "E7": ["email {person} that {msg}", "send a mail to {person} about {topic}", "write an email to {person} with {file} attached", "mail {file} to {person}", "shoot {person} an email saying {msg}"],
    "Q1": ["when is sunrise tomorrow", "what time does the sun set today", "what phase is the moon in", "next new moon date", "when does the sun go down"],
    "Q2": ["what's the weather like", "will it be sunny {day}", "is it going to rain {day}", "temperature outside", "weather forecast for {place}", "do i need an umbrella {day}"],
    "Q3": ["who wrote hamlet", "how tall is mount everest", "what's the population of {place}", "capital city of {place}", "who invented the telephone", "tell me about {place}"],
    "Q4": ["what is {num} times 12", "convert 5 miles to km", "{num} divided by 4", "20 percent of {num}", "how many ounces in a pound", "square root of {num}", "convert 70 fahrenheit to celsius"],
    "Q5": ["time in {place}", "what's the date next friday", "what time is it in {place} right now", "how many days until new year", "current time at {place}"],
    "F1": ["find {file}", "search my computer for {file}", "where is {file}", "locate the pdf about {topic}", "look for {file} i edited {day}"],
    "F2": ["show my recent files", "what did i download recently", "list the latest downloads", "files i touched today", "recently opened documents"],
    "F3": ["open {file}", "pull up {file}", "launch {file} for me", "let me see {file}"],
    "F4": ["move {file} to {folder}", "rename {file} to final version", "copy {file} to the {folder} folder", "put these files into {folder}", "relocate {file} into {folder}"],
    "F5": ["email {file} to {person}", "send {file} to {person} on teams", "attach {file} and send it to {person}", "mail this document to {person}"],
    "F6": ["share {folder} with {person}", "get me a share link for {file}", "give {person} access to {file}", "create a link to the {folder} folder"],
    "C1": ["what's on my calendar", "show my schedule for {day}", "what meetings do i have today", "anything on {day} afternoon", "am i busy {day}", "my agenda this week"],
    "C2": ["when are {person} and i both free", "find a time that works for me and {person} {day}", "common free slot with {person}", "when can i meet {person} this week"],
    "C3": ["prep me for my next meeting", "what do i need for the {time} call", "show docs related to my next meeting", "brief me before my {time} meeting"],
    "C4": ["add {topic} to my calendar on {day} at {time}", "put a dentist appointment on {day} at {time}", "create an event {day} {time}", "schedule lunch with {person} {day} {time}"],
    "C5": ["block {dur} for focus {day}", "reserve {dur} on my calendar {day} morning", "hold {dur} for deep work", "set aside {dur} {day} for myself"],
    "C6": ["set up a meeting with {person} {day} at {time}", "schedule {dur} with {person} and send the invite", "invite {person} to a call {day}", "organize a team meeting on {day}"],
    "C7": ["move my {time} to {day}", "reschedule the meeting with {person}", "cancel my {time} meeting", "push my {day} meeting to next week", "call off the {topic} meeting"],
    "C8": ["accept the invite from {person}", "decline the {day} meeting", "say yes to the {time} invitation", "turn down the {topic} meeting"],
    "R1": ["remind me to call {person} at {time}", "reminder to buy milk {day}", "don't let me forget the {topic} at {time}", "ping me about {file} {day}", "set a reminder for {time}"],
    "R2": ["set a timer for {dur}", "alarm at {time}", "wake me up at {time}", "timer {dur}", "start a countdown of {dur}"],
    "W1": ["morning brief", "what's my day look like, include urgent mail", "start my day summary", "give me the daily briefing", "brief me on today"],
    "W2": ["turn this email into a calendar event", "add the meeting in this mail to my calendar", "make an event from {person}'s email", "put the date from this email on my calendar"],
    "W3": ["save the attachments from this email to {folder}", "store the invoices from {person}'s mail in {folder}", "download email attachments into the {folder} folder", "put these attachments in the cloud {folder}"],
    "W4": ["send the attachment from {person}'s email to the team chat", "forward the file in that mail to {person} on whatsapp", "pass the attached document from this email to the {topic} group"],
    "W5": ["email this week's report to {person}", "find the latest report and send it to my manager", "send the weekly summary file to {person}", "mail the newest report to {person}"],
    "W6": ["focus mode", "play {song} and silence notifications for {dur}", "i need to concentrate, music and do not disturb for {dur}", "start a focus session for {dur}"],
    "S1": ["turn the volume down", "increase brightness", "mute the sound", "brightness to 30 percent", "volume up a bit", "dim the screen"],
    "S2": ["lock my pc", "lock the screen", "lock this computer now", "secure my laptop"],
    "S3": ["turn on bluetooth", "disable wifi", "switch off bluetooth", "enable wi-fi", "turn the wifi back on"],
    "S4": ["do not disturb for {dur}", "silence notifications", "mute alerts for {dur}", "enable focus assist", "no interruptions for {dur}"],
    "S5": ["take a screenshot", "capture my screen", "grab a screen shot", "snap the screen"],
    "OUT": [
        "delete all my {topic} emails forever", "permanently remove {file}", "post this on instagram", "message {person} on telegram",
        "buy {thing} online", "order food from zomato", "change my windows password", "book me a cab", "fill out this online form",
        "translate this email into french and reply", "call {person}", "ring {person} on the phone", "pay my electricity bill",
        "send a slack message to {person}", "make a zoom call with {person}", "write me a poem", "format my hard drive",
        "reply to this in spanish", "transfer money to {person}", "log me into my bank", "hail an uber", "tweet {msg}",
    ],
}



EXTRA = {
    "A1": ["{app}", "get {app} going", "i need {app}", "switch to {app}", "kill {app}", "end {app}"],
    "A2": ["{song}", "music: {song}", "throw on {song}", "{song} on spotify", "can i get {song}", "blast {song}"],
    "A3": ["hit pause", "turn it up", "turn it down", "bump the volume", "play the next one", "go back a song", "unpause", "shush the music"],
    "A4": ["new video from {creator}", "{creator} latest", "anything new from {creator}", "has {creator} uploaded", "show {creator}'s most recent video"],
    "A5": ["youtube {thing}", "{thing} videos", "find me {thing}", "web search {thing}", "look online for {thing}"],
    "A6": ["{site}", "{site} website", "load {site}", "navigate to {site}.com", "visit {site}"],
    "M1": ["ping {person} {msg}", "wa {person} {msg}", "tell {person} {msg}", "drop {person} a message, {msg}", "whatsapp {person}"],
    "M2": ["drop {file} in my whatsapp chat with {person}", "wa {file} to {person}", "{file} to {person} on whatsapp"],
    "M3": ["did anyone text me", "new texts?", "check my whatsapp inbox", "unread whatsapps", "any chats i missed"],
    "M4": ["let the team know {msg}", "drop a note in teams: {msg}", "ping the teams group {msg}", "notify the channel {msg}"],
    "E1": ["urgent mail?", "anything pressing in my inbox", "important emails", "any priority mail", "mail that needs me now"],
    "E2": ["what's {person}'s mail about", "short summary of that thread", "gist of this email", "explain this email", "what does this mail want"],
    "E3": ["dig up the mail about {topic}", "mail from {person}", "anything from {person} on {topic}", "find that email about {topic}", "{topic} emails"],
    "E4": ["emails i haven't answered", "unreplied mail", "who's waiting on me", "pending replies", "mail i owe a response to"],
    "E5": ["write back to {person}, don't send", "reply draft for {person}", "prepare a response saying {msg}", "draft reply: {msg}"],
    "E6": ["clean out the promotional mail", "archive the junk", "mark everything as read", "tidy my inbox", "archive {person}'s mail"],
    "E7": ["mail {person} {msg}", "email to {person}: {msg}", "send {person} a mail about {topic}", "write to {person} about {topic}"],
    "Q1": ["when will the sun rise", "sunset time", "is it a full moon tonight", "moon phase", "sunrise {day}"],
    "Q2": ["how hot is it outside", "should i carry a jacket {day}", "rain {day}?", "weather in {place}", "weather", "is it cold out"],
    "Q3": ["how far is the moon", "who painted the mona lisa", "when was the eiffel tower built", "what is photosynthesis", "meaning of the word {thing}"],
    "Q4": ["{num} plus 45", "convert 10 kg to pounds", "tip on {num}", "what's 15% of {num}", "{num} minus 18", "how many cm in 5 inches"],
    "Q5": ["time in {place}", "what day is the 30th", "{place} time", "what's today's date", "how many days till {day}"],
    "F1": ["where did i save {file}", "find the pdf about {topic}", "search files for {topic}", "{file} where is it", "dig up {file}", "that {topic} file"],
    "F2": ["what files did i open lately", "everything i downloaded this morning", "recent docs", "my latest downloads"],
    "F3": ["bring up {file}", "show me {file}", "open up {file}", "{file} please"],
    "F4": ["put {file} into {folder}", "rename {file}", "copy these into {folder}", "shift {file} to {folder}", "dump {file} in {folder}"],
    "F5": ["attach {file} and mail it to {person}", "share this doc with {person} by email", "send {file} over to {person}", "pass {file} to {person}"],
    "F6": ["give {person} a link to {folder}", "share {file} with {person}", "let {person} see {file}", "sharing link for {folder}"],
    "C1": ["do i have meetings {day}", "what does {day} look like", "calendar for {day}", "schedule", "am i free {day}", "what's on {day}"],
    "C2": ["find a slot for {person} and me", "when are {person} and i both available", "free time with {person}", "when can {person} and i sync"],
    "C3": ["what should i look at before my {time}", "prep me for the next meeting", "docs for my {time}", "meeting prep"],
    "C4": ["put {topic} on my calendar for {day} at {time}", "new event {day} {time}", "calendar entry: {topic} {day}", "add {topic} {day}"],
    "C5": ["keep {dur} free {day}", "block {dur} {day}", "focus time {day} {dur}", "reserve {dur} for me"],
    "C6": ["get a meeting with {person} {day} {time}", "invite {person} for {dur} {day}", "book a call with {person}", "set up a meeting {day}"],
    "C7": ["push my {time} to {day}", "cancel {day}'s {topic}", "move the {topic} meeting", "reschedule {day}"],
    "C8": ["say yes to {person}'s invite", "reject the {day} review", "decline it", "accept the meeting from {person}", "rsvp yes"],
    "R1": ["remind me {topic} {day}", "ping me at {time} about {topic}", "remind me to buy milk", "reminder: {topic} at {time}", "remind me in {dur}"],
    "R2": ["{dur} timer please", "wake me at {time}", "timer for {dur}", "alarm {time}", "countdown {dur}"],
    "W1": ["how does my day look, anything urgent", "brief me for the day", "my morning rundown", "daily summary", "what do i need to know today"],
    "W2": ["put this email's meeting on my calendar", "make a calendar event out of {person}'s mail", "calendar this email", "event from this email"],
    "W3": ["save the attachments from this mail to {folder}", "put the attachments into {folder}", "keep these attachments in {folder}", "store attached files in {folder}"],
    "W4": ["pass the attachment from {person}'s email to the team chat", "send this email's attachment to {person} on whatsapp", "forward the attached file to {person} on teams"],
    "W5": ["email this week's report to my manager", "find the newest report and mail it to {person}", "weekly report to {person}", "send the latest report to {person}"],
    "W6": ["focus mode for {dur}", "concentration mode", "i need to concentrate", "work mode: music and silence for {dur}", "deep work mode"],
    "S1": ["make the screen brighter", "turn it down a bit", "brightness down", "volume lower", "less bright", "sound up"],
    "S2": ["lock the pc", "lock my screen now", "lock up", "lock it"],
    "S3": ["bluetooth on", "disconnect from wifi", "airplane mode", "wifi on", "kill bluetooth"],
    "S4": ["no pings for {dur}", "turn on dnd", "radio silence for {dur}", "mute all alerts", "quiet mode {dur}", "stop notifying me"],
    "S5": ["screenshot please", "capture what's on my screen", "screen grab", "snip the screen"],
    "OUT": [
        "delete every mail from last year", "sell my old laptop", "message {person} on snapchat", "buy me a ticket to {place}",
        "ring {person}", "set up my bank account", "reply to this email in tamil", "what is the meaning of life, write an essay",
        "uninstall windows", "post on facebook", "book a table at a restaurant", "turn on the lights", "do my homework",
        "send {person} a voice note", "unsubscribe me from everything", "hack into {person}'s account", "tell me a joke",
    ],
}
for k, v in EXTRA.items():
    T[k] = T[k] + v

def fill(template):
    out = template
    for key, vals in SLOTS.items():
        while "{" + key + "}" in out:
            out = out.replace("{" + key + "}", random.choice(vals), 1)
    return out


def typo(text):
    w = text.split()
    if not w:
        return text
    i = random.randrange(len(w))
    word = w[i]
    if len(word) > 3:
        j = random.randrange(1, len(word) - 1)
        kind = random.random()
        if kind < 0.4:
            word = word[:j] + word[j + 1:]
        elif kind < 0.7:
            word = word[:j] + word[j + 1] + word[j] + word[j + 2:]
        else:
            word = word[:j] + word[j] + word[j:]
    w[i] = word
    return " ".join(w)


def variants(text):
    if random.random() < 0.3:
        text = text.lower().replace("'", "")
    if random.random() < 0.2:
        text = typo(text)
    if random.random() < 0.35:
        text = text.capitalize()
    if random.random() < 0.3:
        text += random.choice([".", "?", " please", " pls", " for me"])
    if random.random() < 0.15:
        text = random.choice(["hey ", "ok ", "can you ", "could you "]) + text
    return text


CHAIN_JOIN = [" and ", " then ", " and then ", ", then ", " after that "]
CHAIN_PAIRS = [
    ("A2", "S4"), ("F1", "F5"), ("C1", "M1"), ("E6", "E1"), ("A1", "A5"), ("S5", "E7"),
    ("S4", "S1"), ("W2", "C6"), ("F1", "M2"), ("E3", "E2"), ("R1", "C4"), ("S1", "A2"),
    ("A6", "A5"), ("F3", "S3"), ("S5", "F5"), ("C1", "E1"), ("E3", "E5"), ("Q2", "M1"),
]


def main():
    rows = []
    for label, templates in T.items():
        n = 100 if label != "OUT" else 400
        for _ in range(n):
            rows.append({"text": variants(fill(random.choice(templates))), "labels": [label]})
    random.shuffle(rows)
    with open("data/train.jsonl", "w") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")
    print(len(rows), "training rows")


if __name__ == "__main__":
    main()
