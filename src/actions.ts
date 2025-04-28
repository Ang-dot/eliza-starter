import {
    Action,
    IAgentRuntime,
    Memory,
} from "@elizaos/core";
import { AcpToken } from "./acpPlugin/acpToken.ts";
import { AcpClient } from "./acpPlugin/acpClient.ts";

/* ------------------------------------------------------------------ *
 * 1️⃣  Boot once and reuse a single ACP client instance              *
 * ------------------------------------------------------------------ */
let acpClient: AcpClient;

async function initAcpClient() {
    if (acpClient) return acpClient;

    const token = await AcpToken.build(
        `0x${process.env.ACP_PRIVATE_KEY}`,
        Number(process.env.ACP_SESSION_ENTITY_ID),
        process.env.ACP_AGENT_WALLET as `0x${string}`
    );

    acpClient = new AcpClient(
        process.env.ACP_API_KEY!,
        token
    );

    return acpClient;
}

/* ------------------------------------------------------------------ *
 * 2️⃣  RESPOND_JOB — accept / reject an inbound job offer            *
 * ------------------------------------------------------------------ */
export const respondJobAction: Action = {
    name: "RESPOND_JOB",
    description:
        "Approve or reject an ACP job offer. Pattern: 'accept|reject <jobId> <memoId> because <reason>'",
    similes: ["ACCEPT_OFFER", "REJECT_OFFER"],
    examples: [
        [
            { user: "{{user1}}", content: { text: "accept 42 101 because price is fine 👍" } },
            { user: "{{agent}}", content: { text: "Accepted job 42 – let’s build!", action: "RESPOND_JOB" } }
        ],
        [
            { user: "{{user1}}", content: { text: "reject 55 109 because scope unclear" } },
            { user: "{{agent}}", content: { text: "Rejected job 55 – reach out if specs change!", action: "RESPOND_JOB" } }
        ]
    ],

    validate: async (_rt: IAgentRuntime, _msg: Memory) => true, // skip validation

    handler: async (_rt: IAgentRuntime, msg: Memory) => {
        const [verb, jobIdStr, memoIdStr, ...reasonParts] = msg.content.text.split(/\s+/);
        const accept = verb.toLowerCase() === "accept";
        const jobId = Number(jobIdStr);
        const memoId = Number(memoIdStr);
        const reason = reasonParts.slice(1).join(" ");

        const client = await initAcpClient();
        await client.responseJob(jobId, accept, memoId, reason);

        const responseText = accept
            ? `Accepted job ${jobId} – ${reason}`
            : `Rejected job ${jobId} – ${reason}`;

        return {
            user: "agent",
            content: {
                text: responseText,
                action: "RESPOND_JOB",
            },
        };
    },
};

/* ------------------------------------------------------------------ *
 * 3️⃣  DELIVER_JOB — upload deliverable + advance phase              *
 * ------------------------------------------------------------------ */
export const deliverJobAction: Action = {
    name: "DELIVER_JOB",
    description:
        "Send final work for an ACP job. Pattern: 'deliver <jobId> <url-or-text>'",
    similes: ["SUBMIT_WORK", "COMPLETE_JOB"],
    examples: [
        [
            { user: "{{user1}}", content: { text: "deliver 42 https://ipfs.io/ipfs/xyz" } },
            { user: "{{agent}}", content: { text: "Delivered job 42 – enjoy! 🎉", action: "DELIVER_JOB" } }
        ]
    ],

    validate: async (_rt, _msg) => true, // skip validation

    handler: async (_rt, msg) => {
        const [, jobIdStr, ...deliverableParts] = msg.content.text.split(/\s+/);
        const jobId = Number(jobIdStr);
        const deliverable = deliverableParts.join(" ");

        const client = await initAcpClient();
        await client.deliverJob(jobId, deliverable);

        return {
            user: "agent",
            content: {
                text: `Delivered job ${jobId} – hope it rocks!`,
                action: "DELIVER_JOB",
            },
        };
    },
};
